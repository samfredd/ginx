import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button onClick={copy} style={{ padding: '2px 8px', fontSize: 12 }}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const PLACEHOLDER_RE = /<([^<>]+)>/g;

// Splits a usage string like "phishlets hostname <phishlet> <hostname>" into
// alternating literal/placeholder parts, so a fill-in-the-blanks form can be
// rendered and the result recombined into a runnable command.
function parseUsage(usage) {
  const parts = [];
  let lastIndex = 0;
  let match;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(usage))) {
    if (match.index > lastIndex) parts.push({ type: 'literal', text: usage.slice(lastIndex, match.index) });
    parts.push({ type: 'placeholder', label: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < usage.length) parts.push({ type: 'literal', text: usage.slice(lastIndex) });
  return parts;
}

function CommandRunner({ usage }) {
  const parts = parseUsage(usage);
  const placeholderCount = parts.filter((p) => p.type === 'placeholder').length;
  const [values, setValues] = useState(Array(placeholderCount).fill(''));
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  function setValueAt(idx, v) {
    const next = values.slice();
    next[idx] = v;
    setValues(next);
  }

  const built = (() => {
    let i = 0;
    return parts.map((p) => (p.type === 'literal' ? p.text : values[i++] || `<${p.label}>`)).join('');
  })();

  async function run() {
    setError('');
    setResult('');
    setRunning(true);
    try {
      const res = await api.post('/api/console/exec', { command: built });
      setResult(res.raw);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card stack" style={{ margin: '4px 0' }}>
      {placeholderCount === 0 ? (
        <p className="dim" style={{ margin: 0 }}>This command takes no arguments.</p>
      ) : (
        <div className="row wrap">
          {parts.map((p, i) => {
            if (p.type === 'literal') return null;
            const idx = parts.slice(0, i).filter((x) => x.type === 'placeholder').length;
            return (
              <label key={i} className="stack" style={{ gap: 2 }}>
                <span className="dim" style={{ fontSize: 11 }}>{p.label}</span>
                <input value={values[idx]} onChange={(e) => setValueAt(idx, e.target.value)} placeholder={p.label} />
              </label>
            );
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <code className="dim" style={{ fontSize: 12 }}>{built}</code>
        <button className="primary" onClick={run} disabled={running}>{running ? 'Running...' : 'Send'}</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      {result && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{result}</pre>}
    </div>
  );
}

export default function CommandReference() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [runningUsage, setRunningUsage] = useState(null);

  useEffect(() => {
    api.get('/api/help').then((d) => setGroups(d.groups)).catch((e) => setError(e.message));
  }, []);

  const needle = filter.trim().toLowerCase();
  const filteredGroups = (groups || [])
    .map((g) => ({
      ...g,
      commands: g.commands.filter(
        (c) => !needle || c.usage.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle)
      ),
    }))
    .filter((g) => g.commands.length > 0);

  return (
    <div className="stack">
      <h2>Command Reference</h2>
      <p className="dim">
        Every evilginx console command, pulled live from its own `help` output. Copy it into the Terminal, or click
        Run to fill in the blanks and send it straight to the console from here.
      </p>
      {error && <div className="error-text">{error}</div>}

      <input
        placeholder="Filter commands..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 400 }}
      />

      {filteredGroups.map((g) => (
        <div className="card" key={g.category}>
          <h3 style={{ margin: '0 0 4px 0', textTransform: 'capitalize' }}>{g.category}</h3>
          <p className="dim" style={{ marginTop: 0 }}>{g.summary}</p>
          <div className="table-scroll">
          <table>
            <tbody>
              {g.commands.map((c, i) => {
                const key = `${g.category}-${i}`;
                return (
                  <React.Fragment key={key}>
                    <tr>
                      <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.usage}</td>
                      <td className="dim">{c.description}</td>
                      <td style={{ width: 140 }} className="row">
                        <CopyButton text={c.usage} />
                        <button onClick={() => setRunningUsage(runningUsage === key ? null : key)}>
                          {runningUsage === key ? 'Close' : 'Run'}
                        </button>
                      </td>
                    </tr>
                    {runningUsage === key && (
                      <tr>
                        <td colSpan={3}><CommandRunner usage={c.usage} /></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      {groups === null && !error && <p className="dim">Loading...</p>}
    </div>
  );
}
