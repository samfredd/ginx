import { Router } from 'express';
import multer from 'multer';
import { writeFileContent, fileExists } from '../lib/fsSandbox.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 } });
// Domain names only — this becomes the exact cache key/filename Go's
// autocert.DirCache looks up by SNI hostname.
const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62}\.)+[a-zA-Z]{2,}$/;

function looksLikePem(s, label) {
  return s.includes(`-----BEGIN`) && s.includes(`-----END`) ? null : `${label} does not look like a PEM file`;
}

// Uploads a custom cert+key for a domain, bypassing Let's Encrypt/autocert.
// Go's autocert.Manager (which evilginx uses for TLS) checks its on-disk
// DirCache before requesting a new certificate — the cache format is the
// certificate chain's PEM block(s) immediately followed by the private key's
// PEM block, all in one file named exactly as the SNI hostname, under
// crt/sites/. Autocert must stay enabled for the cache to be consulted; if
// this doesn't parse as a valid cert for the domain, the Manager just falls
// back to requesting a fresh one from Let's Encrypt — not a crash, just a
// silent miss.
router.post('/upload', upload.fields([{ name: 'cert', maxCount: 1 }, { name: 'key', maxCount: 1 }]), async (req, res) => {
  const { domain } = req.body || {};
  if (!domain || !DOMAIN_RE.test(domain)) return res.status(400).json({ error: 'a valid domain name is required' });

  const certFile = req.files?.cert?.[0];
  const keyFile = req.files?.key?.[0];
  if (!certFile || !keyFile) return res.status(400).json({ error: 'both cert and key files are required' });

  const certPem = certFile.buffer.toString('utf8').trim();
  const keyPem = keyFile.buffer.toString('utf8').trim();
  const certErr = looksLikePem(certPem, 'Certificate file');
  const keyErr = looksLikePem(keyPem, 'Key file');
  if (certErr || keyErr) return res.status(400).json({ error: [certErr, keyErr].filter(Boolean).join('; ') });

  const overwrite = req.body?.overwrite === 'true';
  try {
    if (!overwrite && (await fileExists('config', `crt/sites/${domain}`))) {
      return res.status(409).json({ error: `a cached certificate for "${domain}" already exists` });
    }
    await writeFileContent('config', `crt/sites/${domain}`, certPem + '\n' + keyPem + '\n');
    res.json({ ok: true, domain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
