import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';
import { evilginx } from '../lib/evilginxProcess.js';

const router = Router();

// Evilginx only scans the phishlets directory at startup, so phishlets
// created/deleted through the builder or file editor need this to appear.
router.post('/restart-evilginx', async (req, res) => {
  try {
    await evilginx.restart();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic escape hatch: run any raw console command and get its parsed table
// (if any) plus the raw text back. This backs the "control every part"
// requirement for anything the structured pages don't wrap explicitly.
router.post('/exec', async (req, res) => {
  const { command } = req.body || {};
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command (string) is required' });
  }
  try {
    const result = await runAndParse(command);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
