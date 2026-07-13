import { evilginx } from './evilginxProcess.js';
import { parseTable } from './tableParser.js';

// evilginx logs its own errors to the console (e.g. "[err] lures: edit: lure
// hostname must end with the base domain") but still exits its command loop
// normally — there's no non-zero exit code or distinct failure signal to
// catch. Surface any [err] line as a thrown error so routes return it as an
// HTTP error instead of silently reporting success.
const ERR_LINE_RE = /^\[.*?\]\s*\[err\]\s*(.+)$/m;

export async function runAndParse(cmd) {
  const raw = await evilginx.sendCommand(cmd);
  const errMatch = ERR_LINE_RE.exec(raw);
  if (errMatch) {
    const err = new Error(errMatch[1].trim());
    err.raw = raw;
    throw err;
  }
  return { raw, rows: parseTable(raw) };
}
