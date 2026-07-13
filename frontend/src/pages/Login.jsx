import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    onLogin(pw).catch(() => {
      setError('Incorrect password');
      setBusy(false);
    });
  }

  return (
    <div className="login-screen">
      <form className="login-box stack" onSubmit={submit}>
        <h2>ginx console</h2>
        <input
          type="password"
          placeholder="WEB_UI_PASSWORD"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {error && <div className="error-text">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Checking...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
