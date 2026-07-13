import { Router } from 'express';
import { loadNotifyConfig, saveNotifyConfig } from '../lib/notifyConfig.js';
import { sendTelegramMessage } from '../lib/telegramSender.js';

const router = Router();

router.get('/config', async (req, res) => {
  try {
    res.json(await loadNotifyConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', async (req, res) => {
  const { token, chatId, enabled } = req.body || {};
  try {
    const next = await saveNotifyConfig({
      ...(token !== undefined ? { token } : {}),
      ...(chatId !== undefined ? { chatId } : {}),
      ...(enabled !== undefined ? { enabled: !!enabled } : {}),
    });
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const cfg = await loadNotifyConfig();
    if (!cfg.token || !cfg.chatId) return res.status(400).json({ error: 'token and chatId are required' });
    await sendTelegramMessage(cfg.token, cfg.chatId, '✅ Test notification from ginx console — Telegram alerts are working.');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
