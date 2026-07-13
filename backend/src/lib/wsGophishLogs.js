import { WebSocketServer } from 'ws';
import { checkWsAuth } from './auth.js';
import { FileTailer } from './fileTail.js';

const LOG_PATH = process.env.GOPHISH_LOG_PATH || '/gophish-data/gophish.log';

export function attachGophishLogsWs(server) {
  const tailer = new FileTailer(LOG_PATH);
  tailer.start();

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws/gophish-logs') return;

    if (!checkWsAuth(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws) => {
    ws.send(await tailer.getHistory());

    const onData = (text) => {
      if (ws.readyState === ws.OPEN) ws.send(text);
    };
    tailer.on('data', onData);

    ws.on('close', () => tailer.removeListener('data', onData));
  });

  return wss;
}
