// Evilginx console commands (phishlets, lures, sessions) print ASCII box-drawing
// tables. We already strip ANSI color codes upstream; this turns the remaining
// plain-text table into an array of row objects keyed by header name.
export function parseTable(text) {
  const lines = text.split('\n').map((l) => l.trimEnd());
  const rowLines = lines.filter((l) => l.trim().startsWith('|'));
  if (rowLines.length < 2) return [];

  const splitRow = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

  const header = splitRow(rowLines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < rowLines.length; i++) {
    const cells = splitRow(rowLines[i]);
    if (cells.length !== header.length) continue;
    const row = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx];
    });
    rows.push(row);
  }
  return rows;
}
