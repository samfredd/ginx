import yaml from 'js-yaml';

// Builds a phishlet YAML document from the structured form fields submitted
// by the phishlet builder UI. Users can still hand-edit the resulting YAML
// afterwards through the raw file editor.
export function buildPhishletYaml(form) {
  const doc = {
    name: form.name,
    author: form.author || '@unknown',
    min_ver: form.minVer || '3.3.0',
    proxy_hosts: (form.proxyHosts || []).map((h) => ({
      phish_sub: h.phishSub || '',
      orig_sub: h.origSub || '',
      domain: h.domain,
      session: !!h.session,
      is_landing: !!h.isLanding,
      auto_filter: h.autoFilter !== false,
    })),
  };

  if (form.subFilters && form.subFilters.length) {
    doc.sub_filters = form.subFilters.map((f) => ({
      triggers_on: f.triggersOn,
      orig_sub: f.origSub || '',
      domain: f.domain,
      search: f.search,
      replace: f.replace,
      mimes: (f.mimes && f.mimes.length ? f.mimes : ['text/html', 'application/json', 'application/javascript']),
    }));
  }

  if (form.authTokens && form.authTokens.length) {
    doc.auth_tokens = form.authTokens.map((t) => ({
      domain: t.domain,
      keys: t.keys || [],
    }));
  }

  if (form.credentials) {
    doc.credentials = {};
    if (form.credentials.username) {
      doc.credentials.username = {
        key: form.credentials.username.key || 'username',
        search: form.credentials.username.search || '(.*)',
        type: form.credentials.username.type || 'post',
      };
    }
    if (form.credentials.password) {
      doc.credentials.password = {
        key: form.credentials.password.key || 'password',
        search: form.credentials.password.search || '(.*)',
        type: form.credentials.password.type || 'post',
      };
    }
    if (form.credentials.custom && form.credentials.custom.length) {
      doc.credentials.custom = form.credentials.custom.map((c) => ({
        key: c.key,
        search: c.search || '(.*)',
        type: c.type || 'post',
        name: c.name || c.key,
      }));
    }
  }

  if (form.login) {
    doc.login = {
      domain: form.login.domain,
      path: form.login.path || '/',
    };
  }

  return yaml.dump(doc, { lineWidth: 120, noRefs: true });
}

export function scaffoldForm(name) {
  return {
    name,
    author: '@yourlab',
    minVer: '3.3.0',
    proxyHosts: [
      { phishSub: 'www', origSub: 'www', domain: 'example.com', session: true, isLanding: true },
    ],
    subFilters: [],
    authTokens: [{ domain: '.example.com', keys: ['session'] }],
    credentials: {
      username: { key: 'email', search: '(.*)', type: 'post' },
      password: { key: 'password', search: '(.*)', type: 'post' },
    },
    login: { domain: 'www.example.com', path: '/login' },
  };
}
