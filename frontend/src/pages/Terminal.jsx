import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { wsUrl } from '../lib/api.js';

export default function TerminalPage() {
  const containerRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      convertEol: true,
      theme: { background: '#000000' },
      fontSize: 13,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    const ws = new WebSocket(wsUrl('/ws/console'));
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      term.write('\r\n\x1b[90m[connected to evilginx console]\x1b[0m\r\n');
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
      term.write(data);
    };
    ws.onclose = () => term.write('\r\n\x1b[90m[disconnected]\x1b[0m\r\n');

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });

    const onResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="stack">
      <h2>Terminal</h2>
      <p className="dim">Direct access to the Evilginx console — anything not covered by the other pages can be run here.</p>
      <div className="terminal-wrap" ref={containerRef} />
    </div>
  );
}
