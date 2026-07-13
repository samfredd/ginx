import { Router } from 'express';
import { evilginx } from '../lib/evilginxProcess.js';

const router = Router();

// Top-level `help` output lists categories as "name : description" lines.
function parseCategories(raw) {
  const categories = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (m) categories.push({ name: m[1], description: m[2].trim() });
  }
  return categories;
}

// `help <category>` lists "usage" lines (single leading space) each followed
// by a 3-space-indented description line. Paragraph text above the list also
// has single-space indentation but has no indented follow-up, so it's
// naturally skipped.
function parseCommands(raw) {
  const lines = raw.split('\n');
  const commands = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^ (\S.*)$/);
    if (!m) continue;
    const next = lines[i + 1] || '';
    const d = next.match(/^ {3}(\S.*)$/);
    if (d) {
      commands.push({ usage: m[1].trim(), description: d[1].trim() });
      i++;
    }
  }
  return commands;
}

// Full command reference for the Command Reference page: queries `help` for
// the category list, then `help <category>` for each one's usage/description
// pairs. Cached briefly since evilginx's command set never changes at runtime.
let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

router.get('/', async (req, res) => {
  if (cache && Date.now() - cacheAt < CACHE_MS) {
    return res.json(cache);
  }
  try {
    const top = await evilginx.sendCommand('help');
    const categories = parseCategories(top);
    const groups = [];
    for (const cat of categories) {
      const raw = await evilginx.sendCommand(`help ${cat.name}`);
      let commands = parseCommands(raw);
      if (commands.length === 0) commands = [{ usage: cat.name, description: cat.description }];
      groups.push({ category: cat.name, summary: cat.description, commands });
    }
    cache = { groups };
    cacheAt = Date.now();
    res.json(cache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
