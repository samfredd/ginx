import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api.js';
import PhishletForm from '../components/PhishletForm.jsx';
import Info from '../components/Info.jsx';

export default function PhishletBuilder() {
  const [name, setName] = useState('new-phishlet');
  const [form, setForm] = useState(null);
  const [mode, setMode] = useState('form');
  const [yamlText, setYamlText] = useState('');
  const [yamlEdited, setYamlEdited] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/api/phishlets/scaffold?name=${encodeURIComponent(name)}`).then(setForm);
  }, []);

  // Keep the YAML in sync with the form until the user starts hand-editing it.
  useEffect(() => {
    if (!form || yamlEdited) return;
    api.post('/api/phishlets/preview', { name, form })
      .then((res) => setYamlText(res.content))
      .catch(() => {});
  }, [form, name, yamlEdited]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = yamlEdited
        ? await api.post('/api/phishlets/raw', { name, content: yamlText })
        : await api.post('/api/phishlets', { name, form });
      // evilginx only scans the phishlets dir at startup, so the new file
      // won't be usable (enable/hostname/etc) until it restarts. The raw
      // endpoint already restarts itself; the form endpoint doesn't.
      if (!yamlEdited) await api.post('/api/console/restart-evilginx');
      navigate(`/phishlets/${res.name}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetYamlFromForm() {
    setYamlEdited(false);
  }

  if (!form) return null;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>New Phishlet</h2>
        <div className="row">
          <button onClick={() => setMode(mode === 'form' ? 'yaml' : 'form')}>
            {mode === 'form' ? 'Edit as YAML' : 'Back to form'}
          </button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? 'Creating...' : 'Create phishlet'}
          </button>
        </div>
      </div>

      <div className="card">
        <label className="stack" style={{ gap: 2, maxWidth: 300 }}>
          <span className="dim" style={{ fontSize: 11 }}>Phishlet name (filename) <Info text="This becomes <name>.yaml. Letters, numbers, and hyphens only — no underscores: evilginx's own filename parser drops everything before an underscore, so 'new_phishlet' would silently register as just 'phishlet'." /></span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        {mode === 'form' ? (
          <PhishletForm form={form} setForm={setForm} />
        ) : (
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <p className="dim" style={{ margin: 0 }}>
                {yamlEdited
                  ? 'Hand-edited — this will be saved as-is, ignoring the form above.'
                  : 'Auto-generated from the form — edit directly to take over.'}
              </p>
              {yamlEdited && <button onClick={resetYamlFromForm}>Reset to form-generated YAML</button>}
            </div>
            <Editor
              height="60vh"
              defaultLanguage="yaml"
              theme="vs-dark"
              value={yamlText || '# generating preview...'}
              onChange={(v) => { setYamlText(v ?? ''); setYamlEdited(true); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
