import React, { useState, useEffect, useRef } from 'react';

export default function SharedText({ text, onChange }) {
  const [local, setLocal] = useState(text || '');
  const [sync, setSync]   = useState(false);
  const debounce = useRef(null);
  const typing = useRef(false);

  useEffect(() => {
    if (!typing.current) setLocal(text || '');
  }, [text]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v); setSync(true); typing.current = true;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      onChange(v); setSync(false);
      setTimeout(() => { typing.current = false; }, 1200);
    }, 400);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label className="field-label" style={{ margin: 0 }}>Shared Clipboard</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {sync && <span style={{ fontFamily: 'var(--font-m)', fontSize: 8, color: 'var(--mint)' }}>● SYNCING</span>}
          {local && <button onClick={() => navigator.clipboard.writeText(local)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border-mid)', background: 'var(--violet-faint)', color: 'var(--violet)', fontSize: 9, cursor: 'pointer' }}>Copy</button>}
          {local && <button onClick={() => { setLocal(''); onChange(''); }} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(242,107,107,0.22)', background: 'var(--rose-faint)', color: 'var(--rose)', fontSize: 9, cursor: 'pointer' }}>Clear</button>}
        </div>
      </div>
      <textarea className="clip-textarea" value={local} onChange={handleChange} rows={6}
        placeholder="Type here — syncs in real time to other devices" />
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', marginTop: 4 }}>
        {local.length} chars
      </div>
    </div>
  );
}