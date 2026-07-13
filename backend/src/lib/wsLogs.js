import { WebSocketServer } from 'ws';
import { evilginx } from './evilginxProcess.js';
import { checkWsAuth } from './auth.js';

// Read-only mirror of the console's raw byte stream, for the Live Logs page.
// Sends buffered history immediately on connect, then streams live output.
// xterm.js on the frontend renders it directly (colors, redraws and all) so
// no server-side ANSI cleanup is needed here.
export function attachLogsWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws/logs') return;

    if (!checkWsAuth(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    ws.send(evilginx.getLogHistory());

    const onData = (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    };
    evilginx.on('raw', onData);

    ws.on('close', () => evilginx.removeListener('raw', onData));
  });

  return wss;
}
