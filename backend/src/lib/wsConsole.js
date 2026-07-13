import { WebSocketServer } from 'ws';
import { evilginx } from './evilginxProcess.js';
import { checkWsAuth } from './auth.js';

export function attachConsoleWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws/console') return;

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
    const onData = (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    };
    evilginx.on('raw', onData);

    ws.on('message', (msg) => {
      let parsed;
      try {
        parsed = JSON.parse(msg.toString());
      } catch {
        evilginx.writeRaw(msg.toString());
        return;
      }
      if (parsed.type === 'input') evilginx.writeRaw(parsed.data);
      else if (parsed.type === 'resize') evilginx.resize(parsed.cols, parsed.rows);
    });

    ws.on('close', () => evilginx.removeListener('raw', onData));
  });

  return wss;
}
