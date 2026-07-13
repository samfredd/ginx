import crypto from 'node:crypto';

const PASSWORD = process.env.WEB_UI_PASSWORD || '';

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAuth(req, res, next) {
  if (!PASSWORD) {
    res.status(500).json({ error: 'WEB_UI_PASSWORD is not set on the server; refusing to serve requests.' });
    return;
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sepIndex = decoded.indexOf(':');
    const pass = sepIndex === -1 ? decoded : decoded.slice(sepIndex + 1);
    if (timingSafeEqual(pass, PASSWORD)) {
      next();
      return;
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="ginx-console"');
  res.status(401).json({ error: 'Unauthorized' });
}

export function checkWsAuth(request) {
  if (!PASSWORD) return false;
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (token) return timingSafeEqual(token, PASSWORD);

  const header = request.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sepIndex = decoded.indexOf(':');
    const pass = sepIndex === -1 ? decoded : decoded.slice(sepIndex + 1);
    return timingSafeEqual(pass, PASSWORD);
  }
  return false;
}
