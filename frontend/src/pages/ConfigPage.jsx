import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api, getPassword } from '../lib/api.js';
import Info from '../components/Info.jsx';

export default function ConfigPage() {
  const [raw, setRaw] = useState('');
  const [configFile, setConfigFile] = useState(null);
  const [configFileSaved, setConfigFileSaved] = useState(false);
  const [configFileError, setConfigFileError] = useState('');
  const [domain, setDomain] = useState('');
  const [externalIp, setExternalIp] = useState('');
  const [bindIp, setBindIp] = useState('');
  const [unauthUrl, setUnauthUrl] = useState('');
  const [args, setArgs] = useState('');
  const [proxyRaw, setProxyRaw] = useState('');
  const [proxyType, setProxyType] = useState('http');
  const [proxyAddress, setProxyAddress] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [certStatus, setCertStatus] = useState('');
  const [certDomain, setCertDomain] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [certKeyFile, setCertKeyFile] = useState(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certUploadError, setCertUploadError] = useState('');
  const [certUploadOk, setCertUploadOk] = useState(false);
  const [gophishAdminUrl, setGophishAdminUrl] = useState('');
  const [gophishApiKey, setGophishApiKey] = useState('');
  const [gophishResult, setGophishResult] = useState('');
  const [error, setError] = useState('');

  function refresh() {
    api.get('/api/config').then((d) => setRaw(d.raw)).catch((e) => setError(e.message));
    api.get('/api/config/proxy').then((d) => setProxyRaw(d.raw)).catch(() => {});
  }
  useEffect(refresh, []);

  function loadConfigFile() {
    setConfigFileError('');
    api.get('/api/files/content?root=config&path=config.json')
      .then((d) => setConfigFile(d.content))
      .catch((e) => setConfigFileError(e.message));
  }
  useEffect(loadConfigFile, []);

  async function saveConfigFile() {
    setConfigFileError('');
    setConfigFileSaved(false);
    try {
      JSON.parse(configFile); // catch typos before writing a file evilginx reads at startup
      await api.put('/api/files/content', { root: 'config', path: 'config.json', content: configFile });
      setConfigFileSaved(true);
    } catch (e) {
      setConfigFileError(e.message);
    }
  }

  // [ \t]* (not \s*) around the colon — \s also matches newlines, and when a
  // field's value is empty the greedy match would otherwise bleed across the
  // line break and pick up the next line's key as the "value".
  const dnsPort = /dns_port[ \t]*:[ \t]*(\S+)/.exec(raw)?.[1];
  const httpsPort = /https_port[ \t]*:[ \t]*(\S+)/.exec(raw)?.[1];
  const currentDomain = /^[ \t]*domain[ \t]*:[ \t]*(\S*)/m.exec(raw)?.[1];
  const currentExternal = /external_ipv4[ \t]*:[ \t]*(\S*)/.exec(raw)?.[1];
  const currentBind = /bind_ipv4[ \t]*:[ \t]*(\S*)/.exec(raw)?.[1];
  const currentUnauthUrl = /^[ \t]*unauth_url[ \t]*:[ \t]*(\S*)/m.exec(raw)?.[1];
  const autocertOn = /autocert[ \t]*:[ \t]*on/.test(raw);

  async function setDomainNow() {
    if (!domain) return;
    setError('');
    try {
      const res = await api.post('/api/config/domain', { domain });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setIps() {
    setError('');
    try {
      const res = await api.post('/api/config/ip', { external: externalIp || undefined, bind: bindIp || undefined });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setUnauth() {
    if (!unauthUrl) return;
    setError('');
    try {
      const res = await api.post('/api/config/unauth-url', { url: unauthUrl });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleAutocert(enabled) {
    setError('');
    try {
      const res = await api.post('/api/config/autocert', { enabled });
      setRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function testCerts() {
    setError('');
    try {
      const res = await api.post('/api/config/test-certs');
      setCertStatus(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function uploadCert(overwrite = false) {
    if (!certDomain || !certFile || !certKeyFile) {
      setCertUploadError('domain, certificate, and key are all required');
      return;
    }
    setCertUploading(true);
    setCertUploadError('');
    setCertUploadOk(false);
    try {
      const form = new FormData();
      form.append('domain', certDomain);
      form.append('cert', certFile);
      form.append('key', certKeyFile);
      if (overwrite) form.append('overwrite', 'true');
      const res = await fetch('/api/certs/upload', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(':' + getPassword()) },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409 && confirm(`${body.error}. Overwrite it?`)) {
          return uploadCert(true);
        }
        throw new Error(body.error);
      }
      setCertUploadOk(true);
    } catch (e) {
      setCertUploadError(e.message);
    } finally {
      setCertUploading(false);
    }
  }

  async function runArgs() {
    if (!args) return;
    setError('');
    try {
      const res = await api.post('/api/config/set', { args });
      setRaw(res.raw);
      setArgs('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function setProxyEnabled(enabled) {
    setError('');
    try {
      const res = await api.post('/api/config/proxy/enabled', { enabled });
      setProxyRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function applyProxyField(field, value) {
    if (!value) return;
    setError('');
    try {
      const res = await api.post('/api/config/proxy/set', { field, value });
      setProxyRaw(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setGophishAdmin() {
    if (!gophishAdminUrl) return;
    setError('');
    try {
      const res = await api.post('/api/config/gophish/admin-url', { url: gophishAdminUrl });
      setGophishResult(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setGophishKey() {
    if (!gophishApiKey) return;
    setError('');
    try {
      const res = await api.post('/api/config/gophish/api-key', { key: gophishApiKey });
      setGophishResult(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setGophishInsecure(insecure) {
    setError('');
    try {
      const res = await api.post('/api/config/gophish/insecure', { insecure });
      setGophishResult(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  async function testGophish() {
    setError('');
    try {
      const res = await api.post('/api/config/gophish/test');
      setGophishResult(res.raw);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <h2>Config</h2>
      {error && <div className="error-text">{error}</div>}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Domain <Info text="The base domain all phishlet phishing subdomains are built under, e.g. www.yourlab.example for base domain yourlab.example." />
        </h3>
        <p className="dim" style={{ margin: 0 }}>Current: {currentDomain || <em>not set</em>}</p>
        <div className="row">
          <input placeholder="yourlab.example" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button className="primary" onClick={setDomainNow}>Set domain</button>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Network <Info text="External IP is what evilginx advertises publicly (DNS/certs); bind IP is which local interface it listens on — leave bind blank unless you need to restrict it." />
        </h3>
        <p className="dim" style={{ margin: 0 }}>
          External IP: {currentExternal || <em>not set</em>} · Bind IP: {currentBind || <em>not set</em>} ·
          HTTPS port: {httpsPort} · DNS port: {dnsPort}
        </p>
        <div className="row">
          <input placeholder="external IPv4" value={externalIp} onChange={(e) => setExternalIp(e.target.value)} />
          <input placeholder="bind IPv4 (optional)" value={bindIp} onChange={(e) => setBindIp(e.target.value)} />
          <button className="primary" onClick={setIps}>Set IP(s)</button>
        </div>
        <p className="dim" style={{ margin: 0 }}>
          Evilginx serves its own DNS (NS/A records for the phishing subdomains) on the DNS port above once the
          domain is set — there's no separate DNS command beyond domain/IP configuration.
        </p>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Unauthorized redirect <Info text="Global fallback: where evilginx sends visitors/bots that hit a phishlet without a valid lure. Individual phishlets can override this on their own page." />
        </h3>
        <p className="dim" style={{ margin: 0 }}>Current: {currentUnauthUrl || <em>not set</em>}</p>
        <div className="row">
          <input placeholder="https://example.com" value={unauthUrl} onChange={(e) => setUnauthUrl(e.target.value)} style={{ flex: 1 }} />
          <button className="primary" onClick={setUnauth}>Set unauth_url</button>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Certificates <Info text="Autocert automatically requests Let's Encrypt certificates when a phishlet is enabled. Disable it if you're providing your own certs." />
        </h3>
        <p className="dim" style={{ margin: 0 }}>Autocert (Let's Encrypt): {autocertOn ? 'on' : 'off'}</p>
        <div className="row">
          <button onClick={() => toggleAutocert(true)}>Enable autocert</button>
          <button onClick={() => toggleAutocert(false)}>Disable autocert</button>
          <button className="primary" onClick={testCerts} title="Checks that certs are present and valid for every enabled phishlet">Test certs for active phishlets</button>
        </div>
        {certStatus && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{certStatus}</pre>}

        <div className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <p className="dim" style={{ margin: 0 }}>
            Upload custom certificate <Info text="Bypasses Let's Encrypt for one domain by seeding autocert's own cache with your cert+key. Autocert must stay enabled so evilginx checks the cache before requesting a new one." />
          </p>
          {certUploadError && <div className="error-text">{certUploadError}</div>}
          {certUploadOk && <div className="dim">Uploaded — restart evilginx to pick it up.</div>}
          <div className="row wrap">
            <input placeholder="domain, e.g. www.yourlab.example" value={certDomain} onChange={(e) => setCertDomain(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div className="row wrap">
            <label className="stack" style={{ gap: 2 }}>
              <span className="dim" style={{ fontSize: 11 }}>Certificate (.crt/.pem)</span>
              <input type="file" accept=".crt,.pem,.cer" onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
            </label>
            <label className="stack" style={{ gap: 2 }}>
              <span className="dim" style={{ fontSize: 11 }}>Private key (.key/.pem)</span>
              <input type="file" accept=".key,.pem" onChange={(e) => setCertKeyFile(e.target.files?.[0] || null)} />
            </label>
            <button className="primary" onClick={() => uploadCert(false)} disabled={certUploading}>
              {certUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Outbound Proxy <Info text="Routes evilginx's own outbound traffic (to the real target site) through an upstream proxy — useful for testing or avoiding IP reputation issues." />
        </h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{proxyRaw}</pre>
        <div className="row">
          <button onClick={() => setProxyEnabled(true)}>Enable</button>
          <button onClick={() => setProxyEnabled(false)}>Disable</button>
        </div>
        <div className="row wrap">
          <select value={proxyType} onChange={(e) => setProxyType(e.target.value)}>
            <option value="http">http</option>
            <option value="https">https</option>
            <option value="socks5">socks5</option>
            <option value="socks5h">socks5h</option>
          </select>
          <button onClick={() => applyProxyField('type', proxyType)}>Set type</button>
          <input placeholder="address" value={proxyAddress} onChange={(e) => setProxyAddress(e.target.value)} />
          <button onClick={() => applyProxyField('address', proxyAddress)}>Set address</button>
          <input placeholder="port" value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} style={{ width: 80 }} />
          <button onClick={() => applyProxyField('port', proxyPort)}>Set port</button>
        </div>
        <div className="row wrap">
          <input placeholder="username" value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} />
          <button onClick={() => applyProxyField('username', proxyUser)}>Set username</button>
          <input placeholder="password" type="password" value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} />
          <button onClick={() => applyProxyField('password', proxyPass)}>Set password</button>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>
          Gophish integration <Info text="Optional: lets evilginx report captured credentials back to a Gophish campaign for unified tracking. If you're using the bundled gophish service from docker-compose, its admin API is reachable from this container at https://gophish:3333 — log into https://127.0.0.1:3333 first to grab an API key (see README for the first-run admin password)." />
        </h3>
        <div className="row wrap">
          <input placeholder="admin url, e.g. https://gophish:3333" value={gophishAdminUrl} onChange={(e) => setGophishAdminUrl(e.target.value)} style={{ flex: 1 }} />
          <button onClick={setGophishAdmin}>Set admin URL</button>
        </div>
        <div className="row wrap">
          <input placeholder="API key" type="password" value={gophishApiKey} onChange={(e) => setGophishApiKey(e.target.value)} style={{ flex: 1 }} />
          <button onClick={setGophishKey}>Set API key</button>
        </div>
        <div className="row wrap">
          <button onClick={() => setGophishInsecure(true)}>Allow self-signed cert</button>
          <button onClick={() => setGophishInsecure(false)}>Require valid cert</button>
          <button className="primary" onClick={testGophish}>Test connection</button>
          <Info text="The bundled gophish service uses a self-signed admin cert, so click 'Allow self-signed cert' if you're pointing at it." />
        </div>
        {gophishResult && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{gophishResult}</pre>}
      </div>

      <div className="card row">
        <input
          placeholder='raw config args, e.g. "unauth_url https://example.com"'
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={runArgs}>Run: config &lt;args&gt;</button>
        <Info text="Escape hatch for any config subcommand not covered by the fields above — see the Command Reference page for the full list." />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>
            config.json (direct file edit)
            <Info text="The file evilginx reads at startup. Prefer the fields above where possible — those apply live and write this file for you; edit here for anything they don't cover, then restart evilginx to load it." />
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
            height="40vh"
            defaultLanguage="json"
            theme="vs-dark"
            value={configFile}
            onChange={(v) => { setConfigFile(v ?? ''); setConfigFileSaved(false); }}
          />
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Raw config output</h3>
          <button onClick={refresh}>Refresh</button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{raw}</pre>
      </div>
    </div>
  );
}
