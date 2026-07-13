import { Router } from 'express';
import { listDir, readFileContent, writeFileContent, deleteFile } from '../lib/fsSandbox.js';

const router = Router();
const ROOTS = new Set(['phishlets', 'redirectors', 'config', 'gophish']);

function checkRoot(req, res, next) {
  const root = req.query.root || req.body?.root;
  if (!ROOTS.has(root)) {
    return res.status(400).json({ error: `root must be one of: ${[...ROOTS].join(', ')}` });
  }
  next();
}

router.get('/list', checkRoot, async (req, res) => {
  try {
    const entries = await listDir(req.query.root, req.query.path || '.');
    res.json({ entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/content', checkRoot, async (req, res) => {
  try {
    const content = await readFileContent(req.query.root, req.query.path);
    res.json({ content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/content', checkRoot, async (req, res) => {
  const { path: relPath, content } = req.body || {};
  if (!relPath || typeof content !== 'string') {
    return res.status(400).json({ error: 'path and content are required' });
  }
  try {
    await writeFileContent(req.body.root, relPath, content);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/content', checkRoot, async (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path is required' });
  try {
    await deleteFile(req.query.root, relPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
