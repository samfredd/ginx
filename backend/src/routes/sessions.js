import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';
import { extractCookies } from '../lib/sessionCookies.js';

const router = Router();
const ID_RE = /^[0-9]+$/;

router.get('/', async (req, res) => {
  try {
    res.json(await runAndParse('sessions'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
