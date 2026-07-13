import fs from 'node:fs';
import { EventEmitter } from 'node:events';

// Polling-based log tailer rather than fs.watch: the log file lives on a
// bind-mounted Docker volume, and inotify events don't reliably cross that
// boundary on every platform (notably Docker Desktop's gRPC-FUSE on macOS).
export class FileTailer extends EventEmitter {
  constructor(filePath, { pollMs = 1000, historyBytes = 200_000 } = {}) {
    super();
    this.filePath = filePath;
    this.pollMs = pollMs;
    this.historyBytes = historyBytes;
    this.lastSize = 0;
    this._timer = null;
  }

  async getHistory() {
    try {
      const stat = await fs.promises.stat(this.filePath);
      const start = Math.max(0, stat.size - this.historyBytes);
      const text = await this._read(start, stat.size - start);
      this.lastSize = stat.size;
      return text;
    } catch {
      this.lastSize = 0;
      return '';
    }
  }

  async _read(start, length) {
    if (length <= 0) return '';
    const fh = await fs.promises.open(this.filePath, 'r');
    try {
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, start);
      return buf.toString('utf8');
    } finally {
      await fh.close();
    }
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._poll(), this.pollMs);
    this._timer.unref?.();
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  async _poll() {
    try {
      const stat = await fs.promises.stat(this.filePath);
      if (stat.size < this.lastSize) this.lastSize = 0; // truncated/rotated
      if (stat.size > this.lastSize) {
        const text = await this._read(this.lastSize, stat.size - this.lastSize);
        this.lastSize = stat.size;
        this.emit('data', text);
      }
    } catch {
      // log file doesn't exist yet (gophish not started) — retry next tick
    }
  }
}
