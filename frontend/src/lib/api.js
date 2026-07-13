const AUTH_KEY = 'ginx_password';

export function getPassword() {
  return sessionStorage.getItem(AUTH_KEY) || '';
}

export function setPassword(pw) {
  sessionStorage.setItem(AUTH_KEY, pw);
}

export function clearPassword() {
  sessionStorage.removeItem(AUTH_KEY);
}

function authHeader() {
  const pw = getPassword();
  return { Authorization: 'Basic ' + btoa(':' + pw) };
}

async function request(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    clearPassword();
    const err = new Error('Unauthorized');
    err.unauthorized = true;
    throw err;
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data || {}) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data || {}) }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export function wsUrl(path) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const pw = getPassword();
  return `${proto}//${location.host}${path}?token=${encodeURIComponent(pw)}`;
}
