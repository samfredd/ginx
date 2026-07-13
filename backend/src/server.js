import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

import { requireAuth } from './lib/auth.js';
import { evilginx } from './lib/evilginxProcess.js';
import { attachConsoleWs } from './lib/wsConsole.js';
import { attachLogsWs } from './lib/wsLogs.js';
import { attachGophishLogsWs } from './lib/wsGophishLogs.js';

import phishletsRouter from './routes/phishlets.js';
import luresRouter from './routes/lures.js';
import sessionsRouter from './routes/sessions.js';
import configRouter from './routes/config.js';
import filesRouter from './routes/files.js';
import consoleRouter from './routes/console.js';
import blacklistRouter from './routes/blacklist.js';
import helpRouter from './routes/help.js';
import certsRouter from './routes/certs.js';
import gophishRouter from './routes/gophish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.WEB_UI_PORT || 8080;
const EVILGINX_BIN = process.env.EVILGINX_BIN || '/app/evilginx';
const PHISHLETS_DIR = process.env.PHISHLETS_DIR || '/app/phishlets';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.use('/api', requireAuth);
app.use('/api/phishlets', phishletsRouter);
app.use('/api/lures', luresRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/config', configRouter);
app.use('/api/files', filesRouter);
app.use('/api/console', consoleRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/help', helpRouter);
app.use('/api/certs', certsRouter);
app.use('/api/gophish', gophishRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, evilginxRunning: evilginx.ready });
});

const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

const server = http.createServer(app);
attachConsoleWs(server);
attachLogsWs(server);
attachGophishLogsWs(server);

evilginx.start(EVILGINX_BIN, ['-p', PHISHLETS_DIR], {
  cwd: '/app',
  env: process.env,
});

evilginx.on('exit', ({ exitCode, signal }) => {
  console.error(`evilginx process exited (code=${exitCode}, signal=${signal})`);
});

server.listen(PORT, () => {
  console.log(`ginx web console listening on :${PORT}`);
  if (!process.env.WEB_UI_PASSWORD) {
    console.warn('WARNING: WEB_UI_PASSWORD is not set — the API will reject all requests until it is.');
  }
});
