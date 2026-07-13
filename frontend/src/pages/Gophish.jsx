import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';
import LogViewer from '../components/LogViewer.jsx';

export default function Gophish() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [restarting, setRestarting] = useState(false);
  const [configFile, setConfigFile] = useState(null);
  const [configFileSaved, setConfigFileSaved] = useState(false);
  const [configFileError, setConfigFileError] = useState('');

  function refresh() {
    api.get('/api/gophish/status').then(setStatus).catch((e) => setError(e.message));
  }
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  function loadConfigFile() {
    setConfigFileError('');
    api.get('/api/files/content?root=gophish&path=config.json')
      .then((d) => setConfigFile(d.content))
      .catch((e) => setConfigFileError(e.message));
  }
  useEffect(loadConfigFile, []);

  async function saveConfigFile() {
    setConfigFileError('');
    setConfigFileSaved(false);
    try {
      JSON.parse(configFile); // catch typos before writing a file gophish reads at startup
      await api.put('/api/files/content', { root: 'gophish', path: 'config.json', content: configFile });
      setConfigFileSaved(true);
    } catch (e) {
      setConfigFileError(e.message);
    }
  }

  async function restart() {
    if (!confirm('Restart the gophish container? Any in-progress campaign sends will be interrupted.')) return;
    setRestarting(true);
    setError('');
    try {
      await api.post('/api/gophish/restart');
      setTimeout(refresh, 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="stack">
      <h2>Gophish <Info text="The bundled Gophish container — its admin API is what the Config page's Gophish integration talks to. This page controls the container itself, not campaigns (use the Gophish admin UI at :3333 for that)." /></h2>
      {error && <div className="error-text">{error}</div>}

      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span
            className={`badge ${status?.running ? 'enabled' : 'disabled'}`}
          >
            {status ? (status.running ? 'running' : status.status || 'stopped') : 'checking...'}
          </span>
          {status?.startedAt && (
            <span className="dim">since {new Date(status.startedAt).toLocaleString()}</span>
          )}
          {typeof status?.restartCount === 'number' && (
            <span className="dim">· restarted {status.restartCount}x</span>
          )}
        </div>
        <button className="primary" onClick={restart} disabled={restarting}>
          {restarting ? 'Restarting...' : 'Restart gophish'}
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>
            config.json (direct file edit)
            <Info text="Gophish's own config — admin/phish server listen addresses, TLS cert paths, db path, logging. Changes need a restart (button above) to take effect." />
          </h3>
          <div className="row">
            {configFileSaved && <span className="dim">Saved</span>}
            <button onClick={loadConfigFile}>Reload</button>
            <button className="primary" onClick={saveConfigFile}>Save</button>
          </div>
        </div>
        {configFileError && <div className="error-text">{configFileError}</div>}
        {configFile !== null && (
          <Editor
            height="35vh"
            defaultLanguage="json"
            theme="vs-dark"
            value={configFile}
            onChange={(v) => { setConfigFile(v ?? ''); setConfigFileSaved(false); }}
          />
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Logs <Info text="Tails gophish.log from the container's data volume — includes the first-run admin password line after a restart." />
        </h3>
        <LogViewer wsPath="/ws/gophish-logs" height="60vh" />
      </div>
    </div>
  );
}
