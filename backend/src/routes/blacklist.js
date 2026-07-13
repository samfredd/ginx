import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';
import { readFileContent, writeFileContent, fileExists } from '../lib/fsSandbox.js';

const router = Router();
const MODES = new Set(['all', 'unauth', 'noadd', 'off']);
const BLACKLIST_FILE = 'blacklist.txt';

router.get('/', async (req, res) => {
  try {
    const status = await runAndParse('blacklist');
    const ips = (await fileExists('config', BLACKLIST_FILE))
      ? await readFileContent('config', BLACKLIST_FILE)
      : '';
    res.json({ raw: status.raw, ips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mode', async (req, res) => {
  const { mode } = req.body || {};
  if (!MODES.has(mode)) return res.status(400).json({ error: `mode must be one of: ${[...MODES].join(', ')}` });
  try {
    res.json(await runAndParse(`blacklist ${mode}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/log', async (req, res) => {
  const { enabled } = req.body || {};
  try {
    res.json(await runAndParse(`blacklist log ${enabled ? 'on' : 'off'}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The IP/mask list itself lives in a flat file (one entry per line) that
// evilginx reloads on restart; edit it directly rather than one-by-one.
router.put('/ips', async (req, res) => {
  const { ips } = req.body || {};
  if (typeof ips !== 'string') return res.status(400).json({ error: 'ips (string) is required' });
  try {
    await writeFileContent('config', BLACKLIST_FILE, ips);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
