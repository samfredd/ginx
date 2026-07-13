import React, { useEffect, useRef, useState } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder, style }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  function select(opt) {
    setQuery(opt);
    onChange(opt);
    setOpen(false);
  }

  return (
    <div className="searchable-select" ref={containerRef} style={style}>
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="searchable-select-list">
          {filtered.map((opt) => (
            <div key={opt} onClick={() => select(opt)}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}
