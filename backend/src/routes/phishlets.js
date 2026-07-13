import { Router } from 'express';
import multer from 'multer';
import { runAndParse } from '../lib/runCommand.js';
import { listDir, readFileContent, writeFileContent, deleteFile, fileExists } from '../lib/fsSandbox.js';
import { buildPhishletYaml, scaffoldForm } from '../lib/phishletTemplate.js';
import { evilginx } from '../lib/evilginxProcess.js';

const router = Router();
// Underscore is deliberately excluded: evilginx derives a phishlet's
// registered name from its filename using the regex
// `([a-zA-Z0-9\-\.]*)\.yaml`, which doesn't include `_` — a name like
// "new_phishlet" silently registers as just "phishlet" (everything before
// the last unmatched underscore is dropped), which is confusing enough to
// just disallow outright.
const NAME_RE = /^[a-zA-Z0-9-]+$/;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

function fileNameFor(name) {
  return `${name}.yaml`;
}

router.get('/', async (req, res) => {
  try {
    const [files, status] = await Promise.all([
      listDir('phishlets', '.'),
      runAndParse('phishlets'),
    ]);
    // Child phishlets (created via `phishlets create`) have no YAML file of
    // their own, so the live console table — not the directory listing — is
    // the source of truth for what phishlets actually exist.
    const fileByName = {};
    for (const f of files) {
      if (f.type === 'file' && /\.ya?ml$/.test(f.name)) {
        fileByName[f.name.replace(/\.ya?ml$/, '')] = f.name;
      }
    }
    const phishlets = status.rows
      .filter((row) => row.phishlet)
      .map((row) => ({
        ...row,
        name: row.phishlet,
        file: fileByName[row.phishlet],
        isChild: !fileByName[row.phishlet],
      }));
    res.json({ phishlets, raw: status.raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scaffold', (req, res) => {
  const name = (req.query.name || 'new-phishlet').toString();
  res.json(scaffoldForm(name));
});

// Renders YAML from form fields without writing anything to disk.
router.post('/preview', (req, res) => {
  const { name, form } = req.body || {};
  try {
    const yamlContent = buildPhishletYaml({ ...form, name: name || form?.name });
    res.json({ content: yamlContent });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:name/raw', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    const content = await readFileContent('phishlets', fileNameFor(name));
    res.json({ name, content });
  } catch (err) {
    res.status(404).json({ error: 'phishlet not found' });
  }
});

router.put('/:name/raw', async (req, res) => {
  const { name } = req.params;
  const { content } = req.body || {};
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  if (typeof content !== 'string') return res.status(400).json({ error: 'content (string) is required' });
  try {
    await writeFileContent('phishlets', fileNameFor(name), content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Structured create from the phishlet builder form.
router.post('/', async (req, res) => {
  const { name, form, overwrite } = req.body || {};
  if (!name || !NAME_RE.test(name)) {
    return res.status(400).json({ error: 'name must match [a-zA-Z0-9-]+ (no underscores — see NAME_RE comment above)' });
  }
  try {
    if (!overwrite && (await fileExists('phishlets', fileNameFor(name)))) {
      return res.status(409).json({ error: 'a phishlet with this name already exists' });
    }
    const yamlContent = buildPhishletYaml({ ...form, name });
    await writeFileContent('phishlets', fileNameFor(name), yamlContent);
    res.json({ ok: true, name, content: yamlContent });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload an existing phishlet YAML file rather than building one from the form.
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });

  const baseName = req.file.originalname.replace(/\.ya?ml$/i, '');
  // Hyphen, not underscore: evilginx's own filename->name regex doesn't
  // include `_`, so sanitizing into an underscore would recreate the same
  // silent-truncation bug this validation exists to prevent.
  const safeName = baseName.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safeName) return res.status(400).json({ error: 'filename must contain at least one valid character' });
  if (!/\.ya?ml$/i.test(req.file.originalname)) {
    return res.status(400).json({ error: 'only .yaml/.yml files are accepted' });
  }

  const overwrite = req.body?.overwrite === 'true';
  try {
    if (!overwrite && (await fileExists('phishlets', fileNameFor(safeName)))) {
      return res.status(409).json({ error: `"${safeName}" already exists`, name: safeName });
    }
    await writeFileContent('phishlets', fileNameFor(safeName), req.file.buffer.toString('utf8'));
    await evilginx.restart();
    res.json({ ok: true, name: safeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create from hand-edited/pasted YAML (the Builder's YAML editor mode) rather
// than from structured form fields.
router.post('/raw', async (req, res) => {
  const { name, content, overwrite } = req.body || {};
  if (!name || !NAME_RE.test(name)) {
    return res.status(400).json({ error: 'name must match [a-zA-Z0-9-]+ (no underscores — see NAME_RE comment above)' });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content (non-empty string) is required' });
  }
  try {
    if (!overwrite && (await fileExists('phishlets', fileNameFor(name)))) {
      return res.status(409).json({ error: 'a phishlet with this name already exists' });
    }
    await writeFileContent('phishlets', fileNameFor(name), content);
    await evilginx.restart();
    res.json({ ok: true, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    await runAndParse(`phishlets disable ${name}`).catch(() => {});
    await deleteFile('phishlets', fileNameFor(name));
    await evilginx.restart();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/enable', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    const result = await runAndParse(`phishlets enable ${name}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/disable', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    const result = await runAndParse(`phishlets disable ${name}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/hostname', async (req, res) => {
  const { name } = req.params;
  const { hostname } = req.body || {};
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  if (!hostname) return res.status(400).json({ error: 'hostname is required' });
  try {
    const result = await runAndParse(`phishlets hostname ${name} ${hostname}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/get-hosts', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    const result = await runAndParse(`phishlets get-hosts ${name}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    res.json(await runAndParse(`phishlets ${name}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/hide', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    res.json(await runAndParse(`phishlets hide ${name}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/unhide', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    res.json(await runAndParse(`phishlets unhide ${name}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/unauth-url', async (req, res) => {
  const { name } = req.params;
  const { url } = req.body || {};
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    res.json(await runAndParse(`phishlets unauth_url ${name} ${url}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Child phishlets are derived in-memory/config from a template phishlet with
// custom params — they have no YAML file of their own, so create/delete goes
// through the console rather than the filesystem.
router.post('/child', async (req, res) => {
  const { parent, childName, params } = req.body || {};
  if (!NAME_RE.test(parent || '') || !NAME_RE.test(childName || '')) {
    return res.status(400).json({ error: 'parent and childName must match [a-zA-Z0-9-]+ (no underscores)' });
  }
  const kv = Object.entries(params || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  try {
    res.json(await runAndParse(`phishlets create ${parent} ${childName} ${kv}`.trim()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/child/:name', async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid name' });
  try {
    res.json(await runAndParse(`phishlets delete ${name}`));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
