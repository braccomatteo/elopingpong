import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="custom-select" ref={ref}>
      <div className={`custom-select-trigger${open ? ' open' : ''}`} onClick={() => { if (!open) { setOpen(true); setSearch(''); } }}>
        <input
          ref={inputRef}
          type="text"
          className="custom-select-input"
          placeholder={placeholder}
          value={open ? search : (selected ? selected.label : '')}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => { if (!open) { setOpen(true); setSearch(''); } }}
          readOnly={!open}
        />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div className="custom-select-options">
          {filtered.length > 0 ? filtered.map(o => (
            <div
              key={o.value}
              className={`custom-select-option${o.value === value ? ' selected' : ''}${o.special ? ' special' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
            >
              {o.label}
            </div>
          )) : (
            <div className="custom-select-option no-results">Nessun risultato</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
