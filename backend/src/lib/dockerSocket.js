import http from 'node:http';

const SOCKET_PATH = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';

// Talks to the Docker Engine API over its Unix socket directly — no SDK
// dependency needed for the handful of calls this app makes (restart a named
// sibling container, check its status).
function dockerRequest(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCKET_PATH, path, method, headers: { 'Content-Length': 0 } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Docker API ${method} ${path} -> HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      }
    );
    req.on('error', (err) => {
      reject(new Error(`Docker socket unreachable (${SOCKET_PATH}): ${err.message}`));
    });
    req.end();
  });
}

export async function restartContainer(name, timeoutSec = 10) {
  await dockerRequest('POST', `/containers/${encodeURIComponent(name)}/restart?t=${timeoutSec}`);
}

export async function inspectContainer(name) {
  const body = await dockerRequest('GET', `/containers/${encodeURIComponent(name)}/json`);
  const data = JSON.parse(body);
  return {
    running: !!data.State?.Running,
    status: data.State?.Status,
    startedAt: data.State?.StartedAt,
    restartCount: data.RestartCount,
  };
}
