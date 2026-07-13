import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { wsUrl } from '../lib/api.js';

// Read-only xterm.js viewer for a WS endpoint that pushes history on connect
// then streams live output (the /ws/logs and /ws/gophish-logs protocol).
export default function LogViewer({ wsPath, height = '65vh' }) {
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: false,
      disableStdin: true,
      convertEol: true,
      theme: { background: '#000000' },
      fontSize: 12,
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    const ws = new WebSocket(wsUrl(wsPath));
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
      term.write(data, () => {
        if (autoScrollRef.current) term.scrollToBottom();
      });
    };

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      ws.close();
      term.dispose();
    };
  }, [wsPath]);

  return (
    <div className="stack">
      <label className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
        <span className="dim">Auto-scroll</span>
      </label>
      <div className="terminal-wrap" style={{ height }} ref={containerRef} />
    </div>
  );
}
