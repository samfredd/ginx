import React, { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, getPassword, setPassword } from './lib/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PhishletBuilder from './pages/PhishletBuilder.jsx';
import PhishletEditor from './pages/PhishletEditor.jsx';
import FileEditor from './pages/FileEditor.jsx';
import Terminal from './pages/Terminal.jsx';
import Lures from './pages/Lures.jsx';
import Sessions from './pages/Sessions.jsx';
import ConfigPage from './pages/ConfigPage.jsx';
import Blacklist from './pages/Blacklist.jsx';
import LiveLogs from './pages/LiveLogs.jsx';
import CommandReference from './pages/CommandReference.jsx';
import Gophish from './pages/Gophish.jsx';

function RestartButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function restart() {
    if (!confirm('Restart the evilginx process? Active phishing sessions/lures being served will briefly drop.')) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/console/restart-evilginx');
      setMsg('Restarted');
    } catch (e) {
      setMsg('Failed: ' + e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 4000);
    }
  }

  return (
    <div className="stack" style={{ gap: 4 }}>
      {msg && <span className="dim" style={{ fontSize: 11 }}>{msg}</span>}
      <button disabled={busy} onClick={restart} title="Reload phishlets from disk">
        {busy ? 'Restarting...' : 'Restart evilginx'}
      </button>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getPassword()) {
      setAuthed(false);
      return;
    }
    api
      .get('/api/health')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  function handleLogin(pw) {
    setPassword(pw);
    return api.get('/api/health').then(() => setAuthed(true));
  }

  if (authed === null) return null;
  if (!authed) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">&#9776;</button>
        <span>ginx console</span>
      </div>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} onClick={(e) => { if (e.target.tagName === 'A') setSidebarOpen(false); }}>
        <h1>ginx console</h1>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/phishlets/new">Phishlet Builder</NavLink>
        <NavLink to="/lures">Lures</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
        <NavLink to="/blacklist">Blacklist</NavLink>
        <NavLink to="/files">File Editor</NavLink>
        <NavLink to="/config">Config</NavLink>
        <NavLink to="/gophish">Gophish</NavLink>
        <NavLink to="/logs">Live Logs</NavLink>
        <NavLink to="/terminal">Terminal</NavLink>
        <NavLink to="/commands">Command Reference</NavLink>
        <div style={{ flex: 1 }} />
        <RestartButton />
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/phishlets/new" element={<PhishletBuilder />} />
          <Route path="/phishlets/:name" element={<PhishletEditor />} />
          <Route path="/lures" element={<Lures />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/blacklist" element={<Blacklist />} />
          <Route path="/files" element={<FileEditor />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/gophish" element={<Gophish />} />
          <Route path="/logs" element={<LiveLogs />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/commands" element={<CommandReference />} />
        </Routes>
      </div>
    </div>
  );
}
