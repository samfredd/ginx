// Node 20's built-in fetch/FormData/Blob are enough for the Telegram Bot API
// — no SDK dependency needed for two endpoints.
const apiUrl = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function callTelegram(url, options) {
  const res = await fetch(url, options);
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Telegram API returned non-JSON response (HTTP ${res.status})`);
  }
  if (!body.ok) throw new Error(body.description || `Telegram API error (HTTP ${res.status})`);
  return body.result;
}

export async function sendTelegramMessage(token, chatId, text) {
  return callTelegram(apiUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function sendTelegramDocument(token, chatId, filename, content, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([content], { type: 'application/json' }), filename);
  return callTelegram(apiUrl(token, 'sendDocument'), { method: 'POST', body: form });
}
