import React from 'react';

// CSS-only hover/focus tooltip — no positioning JS, works anywhere inline.
export default function Info({ text }) {
  return (
    <span className="info-tip" tabIndex={0}>
      <span className="info-tip-icon">?</span>
      <span className="info-tip-bubble">{text}</span>
    </span>
  );
}
