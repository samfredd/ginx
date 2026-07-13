import React from 'react';
import LogViewer from '../components/LogViewer.jsx';

export default function LiveLogs() {
  return (
    <div className="stack">
      <h2>Live Logs</h2>
      <p className="dim">Read-only mirror of the evilginx console output. Use the Terminal page to send commands.</p>
      <LogViewer wsPath="/ws/logs" height="70vh" />
    </div>
  );
}
