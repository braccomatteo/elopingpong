import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const triggerRef = useRef(null);
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

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
    setSearch('');
  };

  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="custom-select" ref={ref}>
      <div
        ref={triggerRef}
        className={`custom-select-trigger${open ? ' open' : ''}`}
        onClick={() => { if (!open) openDropdown(); }}
      >
        <input
          ref={inputRef}
          type="text"
          className="custom-select-input"
          placeholder={placeholder}
          value={open ? search : (selected ? selected.label : '')}
          onChange={e => { setSearch(e.target.value); if (!open) openDropdown(); }}
          onFocus={() => { if (!open) openDropdown(); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && open && filtered.length > 0) {
              e.preventDefault();
              onChange(filtered[0].value);
              setOpen(false);
              setSearch('');
            }
          }}
        />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div className="custom-select-options" style={dropdownStyle}>
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
