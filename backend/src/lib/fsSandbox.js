import fs from 'node:fs/promises';
import path from 'node:path';

const ROOTS = {
  phishlets: process.env.PHISHLETS_DIR || '/app/phishlets',
  redirectors: process.env.REDIRECTORS_DIR || '/app/redirectors',
  config: process.env.EVILGINX_CONFIG_DIR || '/home/evilginx/.evilginx',
  gophish: process.env.GOPHISH_DATA_DIR || '/gophish-data',
};

export function resolveRoot(rootKey) {
  const root = ROOTS[rootKey];
  if (!root) throw new Error(`Unknown root: ${rootKey}`);
  return root;
}

// Resolves rootKey + relative path, throwing if the result escapes the root.
export function safeResolve(rootKey, relPath = '.') {
  const root = resolveRoot(rootKey);
  const resolved = path.resolve(root, '.' + path.sep + relPath);
  const normalizedRoot = path.resolve(root) + path.sep;
  if (resolved !== path.resolve(root) && !resolved.startsWith(normalizedRoot)) {
    throw new Error('Path escapes allowed root');
  }
  return resolved;
}

export async function listDir(rootKey, relPath = '.') {
  const dirPath = safeResolve(rootKey, relPath);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.join(relPath === '.' ? '' : relPath, e.name),
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

export async function readFileContent(rootKey, relPath) {
  const filePath = safeResolve(rootKey, relPath);
  return fs.readFile(filePath, 'utf8');
}

export async function writeFileContent(rootKey, relPath, content) {
  const filePath = safeResolve(rootKey, relPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function deleteFile(rootKey, relPath) {
  const filePath = safeResolve(rootKey, relPath);
  await fs.rm(filePath, { recursive: true, force: false });
}

export async function fileExists(rootKey, relPath) {
  try {
    await fs.access(safeResolve(rootKey, relPath));
    return true;
  } catch {
    return false;
  }
}
