import { Router } from 'express';
import { runAndParse } from '../lib/runCommand.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await runAndParse('config'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domain', async (req, res) => {
  const { domain } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  try {
    res.json(await runAndParse(`config domain ${domain}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Structured wrapper around `config <args...>` for known subcommands
// (ipv4 external <ip>, ipv4 internal <ip>, unauth <mode>, etc). Anything not
// covered here can still be run from the Terminal page.
router.post('/set', async (req, res) => {
  const { args } = req.body || {};
  if (!args || typeof args !== 'string') return res.status(400).json({ error: 'args (string) is required' });
  try {
    res.json(await runAndParse(`config ${args}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ip', async (req, res) => {
  const { external, bind } = req.body || {};
  if (!external && !bind) return res.status(400).json({ error: 'external and/or bind ip is required' });
  try {
    let last;
    if (external) last = await runAndParse(`config ipv4 external ${external}`);
    if (bind) last = await runAndParse(`config ipv4 bind ${bind}`);
    res.json(last);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/autocert', async (req, res) => {
  const { enabled } = req.body || {};
  try {
    res.json(await runAndParse(`config autocert ${enabled ? 'on' : 'off'}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-certs', async (req, res) => {
  try {
    res.json(await runAndParse('test-certs'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unauth-url', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    res.json(await runAndParse(`config unauth_url ${url}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gophish/admin-url', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    res.json(await runAndParse(`config gophish admin_url ${url}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gophish/api-key', async (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key is required' });
  try {
    res.json(await runAndParse(`config gophish api_key ${key}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gophish/insecure', async (req, res) => {
  const { insecure } = req.body || {};
  try {
    res.json(await runAndParse(`config gophish insecure ${insecure ? 'true' : 'false'}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gophish/test', async (req, res) => {
  try {
    res.json(await runAndParse('config gophish test'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proxy', async (req, res) => {
  try {
    res.json(await runAndParse('proxy'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/proxy/enabled', async (req, res) => {
  const { enabled } = req.body || {};
  try {
    res.json(await runAndParse(`proxy ${enabled ? 'enable' : 'disable'}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PROXY_FIELDS = new Set(['type', 'address', 'port', 'username', 'password']);

router.post('/proxy/set', async (req, res) => {
  const { field, value } = req.body || {};
  if (!PROXY_FIELDS.has(field)) return res.status(400).json({ error: `field must be one of: ${[...PROXY_FIELDS].join(', ')}` });
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });
  try {
    res.json(await runAndParse(`proxy ${field} ${value}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
