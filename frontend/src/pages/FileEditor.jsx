import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api.js';
import Info from '../components/Info.jsx';

const ROOTS = [
  { value: 'phishlets', help: 'YAML definitions for each phishlet.' },
  { value: 'redirectors', help: 'HTML redirector pages shown to visitors before/after the phishing page.' },
  { value: 'config', help: "Evilginx's own config.json, blacklist.txt, and TLS cert storage." },
  { value: 'gophish', help: "Gophish's config.json, sqlite db, self-signed admin cert, and log." },
];

function languageFor(name) {
  if (/\.ya?ml$/.test(name)) return 'yaml';
  if (/\.json$/.test(name)) return 'json';
  if (/\.(html?|htm)$/.test(name)) return 'html';
  if (/\.js$/.test(name)) return 'javascript';
  return 'plaintext';
}

function isHtml(name) {
  return /\.(html?|htm)$/.test(name || '');
}

export default function FileEditor() {
  const [root, setRoot] = useState('phishlets');
  const [entries, setEntries] = useState([]);
  const [dir, setDir] = useState('.');
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [view, setView] = useState('edit');

  function refreshList(nextRoot = root, nextDir = dir) {
    api
      .get(`/api/files/list?root=${nextRoot}&path=${encodeURIComponent(nextDir)}`)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message));
  }

  useEffect(() => refreshList(root, '.'), [root]);

  function openEntry(entry) {
    if (entry.type === 'dir') {
      setDir(entry.path);
      refreshList(root, entry.path);
      return;
    }
    setSelected(entry.path);
    setView('edit');
    api
      .get(`/api/files/content?root=${root}&path=${encodeURIComponent(entry.path)}`)
      .then((d) => setContent(d.content))
      .catch((e) => setError(e.message));
  }

  async function save() {
    if (!selected) return;
    setError('');
    try {
      await api.put('/api/files/content', { root, path: selected, content });
    } catch (e) {
      setError(e.message);
    }
  }

  async function createFile() {
    if (!newFileName) return;
    const relPath = dir === '.' ? newFileName : `${dir}/${newFileName}`;
    try {
      await api.put('/api/files/content', { root, path: relPath, content: '' });
      setNewFileName('');
      refreshList();
      openEntry({ type: 'file', path: relPath });
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteEntry(entry) {
    if (!confirm(`Delete ${entry.path}?`)) return;
    try {
      await api.del(`/api/files/content?root=${root}&path=${encodeURIComponent(entry.path)}`);
      if (selected === entry.path) { setSelected(null); setContent(''); }
      refreshList();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <h2>File Editor <Info text="Direct access to every file evilginx reads — for anything the structured pages (Phishlet Builder, Blacklist, etc.) don't cover." /></h2>
      {error && <div className="error-text">{error}</div>}

      <div className="row wrap">
        {ROOTS.map((r) => (
          <button key={r.value} className={r.value === root ? 'primary' : ''} onClick={() => { setRoot(r.value); setDir('.'); setSelected(null); }} title={r.help}>
            {r.value}
          </button>
        ))}
      </div>

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div className="card" style={{ width: 260 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="dim">/{root}/{dir === '.' ? '' : dir}</span>
            {dir !== '.' && <button onClick={() => { const parent = dir.split('/').slice(0, -1).join('/') || '.'; setDir(parent); refreshList(root, parent); }}>..</button>}
          </div>
          <div className="file-tree">
            {entries.map((e) => (
              <div key={e.path} className={selected === e.path ? 'selected' : ''} onClick={() => openEntry(e)}>
                {e.type === 'dir' ? '📁 ' : '📄 '}{e.name}
                {e.type === 'file' && (
                  <button style={{ float: 'right', padding: '0 6px' }} onClick={(ev) => { ev.stopPropagation(); deleteEntry(e); }}>x</button>
                )}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input placeholder="new-file.yaml" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} />
            <button onClick={createFile}>+</button>
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          {selected ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{selected}</h3>
                <div className="row">
                  {isHtml(selected) && (
                    <>
                      <button onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}>
                        {view === 'edit' ? 'Preview' : 'Back to edit'}
                      </button>
                      <Info text="Renders this HTML in a sandboxed frame — relative image/CSS/script paths won't resolve since it isn't served from a real URL." />
                    </>
                  )}
                  <button className="primary" onClick={save}>Save</button>
                </div>
              </div>
              {view === 'preview' && isHtml(selected) ? (
                <iframe
                  key={selected}
                  title={selected}
                  srcDoc={content}
                  sandbox="allow-scripts"
                  style={{ width: '100%', height: '65vh', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
                />
              ) : (
                <Editor
                  height="65vh"
                  language={languageFor(selected)}
                  theme="vs-dark"
                  value={content}
                  onChange={(v) => setContent(v ?? '')}
                />
              )}
            </>
          ) : (
            <div className="dim">Select a file to edit.</div>
          )}
        </div>
      </div>
    </div>
  );
}
