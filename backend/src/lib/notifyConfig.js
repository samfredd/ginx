import { readFileContent, writeFileContent, fileExists } from './fsSandbox.js';

const FILE = 'notify-telegram.json';
const DEFAULTS = { token: '', chatId: '', enabled: false, lastSeenSessionId: 0 };

export async function notifyConfigExists() {
  return fileExists('config', FILE);
}

export async function loadNotifyConfig() {
  if (!(await fileExists('config', FILE))) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(await readFileContent('config', FILE)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotifyConfig(partial) {
  const current = await loadNotifyConfig();
  const next = { ...current, ...partial };
  await writeFileContent('config', FILE, JSON.stringify(next, null, 2));
  return next;
}
