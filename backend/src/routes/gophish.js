import { Router } from 'express';
import { restartContainer, inspectContainer } from '../lib/dockerSocket.js';

const router = Router();
const CONTAINER_NAME = process.env.GOPHISH_CONTAINER_NAME || 'gophish';

router.get('/status', async (req, res) => {
  try {
    res.json(await inspectContainer(CONTAINER_NAME));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/restart', async (req, res) => {
  try {
    await restartContainer(CONTAINER_NAME);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
