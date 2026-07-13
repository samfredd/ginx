import pty from 'node-pty';
import { EventEmitter } from 'node:events';

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const SETTLE_MS = 600;
const PROMPT_GRACE_MS = 80;
const MAX_WAIT_MS = 90000; // phishlet enable can trigger ACME cert issuance (up to ~60s)
const PROMPT_RE = /:\s*$/;
const MAX_LOG_BUFFER = 300_000; // chars of raw (ANSI-intact) history kept for the Live Logs page

function stripAnsi(str) {
  return str.replace(ANSI_RE, '');
}

// Terminal apps redraw a line by emitting \r then new content instead of \n;
// keep only what's after the last \r on each \n-delimited line so parsed text
// matches what a real terminal would visually show.
function normalizeCarriageReturns(str) {
  // Real newlines arrive as \r\n; normalize those first so the "keep text
  // after the last \r" step below (which handles same-line redraws) doesn't
  // mistake a CRLF's trailing \r for a redraw and blank the line out.
  const withoutCrlf = str.replace(/\r\n/g, '\n');
  return withoutCrlf
    .split('\n')
    .map((line) => {
      const parts = line.split('\r');
      return parts[parts.length - 1];
    })
    .join('\n');
}

// Collapses "<char><backspace>" pairs the shell emits while redrawing input.
function collapseBackspaces(str) {
  let prev;
  let cur = str;
  do {
    prev = cur;
    cur = prev.replace(/[^\n\x08]\x08/g, '');
  } while (cur !== prev);
  return cur.replace(/\x08/g, '');
}

function clean(raw) {
  return collapseBackspaces(normalizeCarriageReturns(stripAnsi(raw)));
}

class EvilginxProcess extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.queue = [];
    this.current = null;
    this.ready = false;
    this.logBuffer = ''; // raw, ANSI-intact — the Live Logs page renders it with xterm.js
  }

  getLogHistory() {
    return this.logBuffer;
  }

  start(binPath, args, opts) {
    this._binPath = binPath;
    this._args = args;
    this._opts = opts;
    this._spawn();
  }

  // Kills and respawns the evilginx process (config/phishlet status persists
  // in its on-disk db). Needed because evilginx only reads the phishlets
  // directory at startup, so newly created/deleted phishlet files require a
  // restart to be picked up.
  restart() {
    return new Promise((resolve, reject) => {
      const waitForBoot = () => {
        // _spawn() only marks the process "ready" once the OS process exists —
        // evilginx itself is still printing its banner and loading phishlets
        // for another second or so. Route a harmless command through the
        // normal command queue so callers get a promise that only resolves
        // once evilginx has actually reached its idle prompt; otherwise a
        // request issued right after restart() can race the boot sequence
        // and see garbled/partial output.
        this.sendCommand('clear').then(() => resolve()).catch(() => resolve());
      };
      if (!this.proc) {
        this._spawn();
        waitForBoot();
        return;
      }
      const onExit = () => {
        this._spawn();
        waitForBoot();
      };
      this.proc.onExit(onExit);
      // Reject queued/in-flight command promises so callers don't hang.
      if (this.current) this.current.reject(new Error('evilginx restarting'));
      this.current = null;
      for (const item of this.queue.splice(0)) item.reject(new Error('evilginx restarting'));
      this.proc.kill();
      setTimeout(() => {
        if (!this.ready) reject(new Error('evilginx did not restart in time'));
      }, 10000);
    });
  }

  _spawn() {
    const binPath = this._binPath;
    const args = this._args;
    const opts = this._opts;
    this.proc = pty.spawn(binPath, args, {
      name: 'xterm-color',
      cols: 120,
      rows: 40,
      cwd: opts.cwd,
      env: opts.env,
    });

    this.proc.onData((data) => {
      this.emit('raw', data);
      this.logBuffer += data;
      if (this.logBuffer.length > MAX_LOG_BUFFER) {
        this.logBuffer = this.logBuffer.slice(this.logBuffer.length - MAX_LOG_BUFFER);
      }
      if (this.current) {
        this.current.buffer += data;
        this._scheduleCheck();
      }
    });

    this.proc.onExit(({ exitCode, signal }) => {
      this.ready = false;
      this.emit('exit', { exitCode, signal });
    });

    this.ready = true;
    this.emit('ready');
  }

  writeRaw(data) {
    if (this.proc) this.proc.write(data);
  }

  resize(cols, rows) {
    if (this.proc) this.proc.resize(cols, rows);
  }

  _scheduleCheck() {
    const item = this.current;
    if (!item) return;
    clearTimeout(item.settleTimer);
    const cleaned = clean(item.buffer);
    // Once the command's own echo is gone and we're back at a bare prompt,
    // resolve quickly; otherwise fall back to a quiet-period settle timer so
    // long-running commands (e.g. cert issuance on phishlet enable) aren't
    // cut off.
    const pastEcho = cleaned.replace(item.echoGuard, '').trim();
    if (PROMPT_RE.test(cleaned) && pastEcho.length > 0) {
      item.settleTimer = setTimeout(() => this._resolveCurrent(), PROMPT_GRACE_MS);
    } else {
      item.settleTimer = setTimeout(() => this._resolveCurrent(), SETTLE_MS);
    }
  }

  _resolveCurrent() {
    const item = this.current;
    if (!item) return;
    clearTimeout(item.settleTimer);
    clearTimeout(item.maxWaitTimer);
    this.current = null;
    const cleaned = clean(item.buffer)
      .split('\n')
      .filter((line) => !line.trim().startsWith(item.echoGuard))
      .join('\n')
      .replace(PROMPT_RE, '')
      .trim();
    item.resolve(cleaned);
    this._dispatchNext();
  }

  _dispatchNext() {
    if (this.current || this.queue.length === 0) return;
    const item = this.queue.shift();
    this.current = item;
    item.buffer = '';
    item.echoGuard = item.cmd;
    item.settleTimer = setTimeout(() => this._resolveCurrent(), SETTLE_MS);
    item.maxWaitTimer = setTimeout(() => this._resolveCurrent(), MAX_WAIT_MS);
    this.proc.write(item.cmd + '\r');
  }

  sendCommand(cmd) {
    if (!this.proc) return Promise.reject(new Error('evilginx process is not running'));
    return new Promise((resolve, reject) => {
      this.queue.push({ cmd, resolve, reject });
      this._dispatchNext();
    });
  }
}

export const evilginx = new EvilginxProcess();
