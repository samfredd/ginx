import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';

export default function PhishletEditor() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [detail, setDetail] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [hostname, setHostname] = useState('');
  const [unauthUrl, setUnauthUrl] = useState('');
  const [childName, setChildName] = useState('');
  const [childParams, setChildParams] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function load() {
    setError('');
    api.get(`/api/phishlets/${name}`).then((d) => {
      setDetail(d.raw);
      // [ \t]* (not \s*) around the colon so an empty value's line break
      // doesn't get crossed into the next field's non-whitespace content.
      setIsChild(/parent[ \t]*:[ \t]*\S/.test(d.raw));
    }).catch((e) => setError(e.message));
    api.get(`/api/phishlets/${name}/raw`).then((d) => setContent(d.content)).catch(() => setContent(null));
  }
  useEffect(load, [name]);

  async function run(action) {
    setError('');
    setStatus('');
    try {
      const res = await api.post(`/api/phishlets/${name}/${action}`);
      setStatus(res.raw);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function save() {
    setError('');
    setSaved(false);
    try {
      await api.put(`/api/phishlets/${name}/raw`, { content });
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setHost() {
    if (!hostname) return;
    setError('');
    try {
      const res = await api.post(`/api/phishlets/${name}/hostname`, { hostname });
      setStatus(res.raw);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function setUnauth() {
    if (!unauthUrl) return;
    setError('');
    try {
      const res = await api.post(`/api/phishlets/${name}/unauth-url`, { url: unauthUrl });
      setStatus(res.raw);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function createChild() {
    if (!childName) return;
    setError('');
    const params = {};
    for (const pair of childParams.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [k, v] = pair.split('=');
      if (k && v !== undefined) params[k.trim()] = v.trim();
    }
    try {
      const res = await api.post('/api/phishlets/child', { parent: name, childName, params });
      setStatus(res.raw);
      setChildName('');
      setChildParams('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function del() {
    if (isChild) {
      if (!confirm(`Delete child phishlet "${name}"?`)) return;
      await api.del(`/api/phishlets/child/${name}`);
    } else {
      if (!confirm(`Delete phishlet "${name}"? This removes its YAML file.`)) return;
      await api.del(`/api/phishlets/${name}`);
    }
    navigate('/');
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{name} {isChild && <span className="dim" style={{ fontSize: 13 }}>(child phishlet)</span>}</h2>
        <div className="row">
          <button onClick={() => run('enable')} title="Serve this phishlet and request a TLS cert if needed">Enable</button>
          <button onClick={() => run('disable')} title="Stop serving this phishlet">Disable</button>
          <button onClick={() => run('hide')} title="Redirect all requests away, hiding the phishing page from scanners">Hide</button>
          <button onClick={() => run('unhide')} title="Make the phishing page reachable again">Unhide</button>
          <button className="danger" onClick={del} title={isChild ? 'Delete this child phishlet' : 'Delete this phishlet\'s YAML file'}>Delete</button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {status && <pre className="card" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{status}</pre>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Details <Info text="Live status straight from evilginx: enabled/disabled, hidden/visible, assigned hostname, and any unauth_url override." /></h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{detail}</pre>
      </div>

      <div className="card stack">
        <div className="row">
          <input placeholder="hostname, e.g. www.yourlab.example" value={hostname} onChange={(e) => setHostname(e.target.value)} />
          <button onClick={setHost}>Set hostname</button>
          <Info text="The phishing subdomain visitors will land on. Must end with the base domain set on the Config page." />
        </div>
        <div className="row">
          <input placeholder="unauth_url override for this phishlet" value={unauthUrl} onChange={(e) => setUnauthUrl(e.target.value)} style={{ flex: 1 }} />
          <button onClick={setUnauth}>Set unauth_url</button>
          <Info text="Where unauthorized/bot requests to this phishlet get redirected. Overrides the global unauth_url just for this phishlet." />
        </div>
        <div className="row">
          <button onClick={() => run('get-hosts')}>Get hosts file entries</button>
          <Info text="Generates /etc/hosts-style entries so you can test this phishlet from localhost without real DNS." />
        </div>
      </div>

      {!isChild && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>
            Create child phishlet from this template
            <Info text="A child phishlet reuses this phishlet's template with different parameter values (e.g. a per-target name/company) — no separate YAML file needed." />
          </h3>
          <div className="row">
            <input placeholder="child name" value={childName} onChange={(e) => setChildName(e.target.value)} />
            <input placeholder="key1=value1, key2=value2" value={childParams} onChange={(e) => setChildParams(e.target.value)} style={{ flex: 1 }} />
            <button className="primary" onClick={createChild}>Create child</button>
          </div>
        </div>
      )}

      {!isChild && content !== null && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Raw YAML (direct file edit) <Info text="Edits here are written straight to the phishlet's YAML file on disk. Restart evilginx (sidebar) to pick up structural changes." /></h3>
            <div className="row">
              {saved && <span className="dim">Saved</span>}
              <button className="primary" onClick={save}>Save</button>
            </div>
          </div>
          <Editor
            height="60vh"
            defaultLanguage="yaml"
            theme="vs-dark"
            value={content}
            onChange={(v) => { setContent(v ?? ''); setSaved(false); }}
          />
        </div>
      )}
    </div>
  );
}
