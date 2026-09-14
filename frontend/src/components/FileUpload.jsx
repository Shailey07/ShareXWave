import React, { useRef, useState } from 'react';

export default function FileUpload({ onUpload, totalBytes = 0, maxBytes = 2 * 1024**3, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef(null);

  const usedPct = Math.min(100, (totalBytes / maxBytes) * 100);
  const fmt = (b) => b < 1024**3 ? (b / 1024**2).toFixed(1) + ' MB' : (b / 1024**3).toFixed(2) + ' GB';

  const handleFiles = async (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    for (const f of arr) {
      setProgress(0);
      await onUpload(f, setProgress);
    }
    setUploading(false); setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t3)' }}>
        <span>Storage: {fmt(totalBytes)} / {fmt(maxBytes)}</span>
        <span>{usedPct.toFixed(0)}%</span>
      </div>
      <div className="quota-bar"><div className="quota-bar-fill" style={{ width: `${usedPct}%` }} /></div>

      <label className={`drop-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{ cursor: disabled || uploading ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
          disabled={disabled || uploading} onChange={(e) => handleFiles(e.target.files)} />
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{uploading ? '⏳' : '☁️'}</div>
          <p style={{ fontWeight: 600, fontSize: 13 }}>{uploading ? `Uploading ${progress}%` : 'Click or drag files here'}</p>
          <p style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', marginTop: 4 }}>
            any file type · up to 2 GB total
          </p>
        </div>
      </label>

      {uploading && <div className="loading-bar"><div className="loading-bar-inner" /></div>}
    </div>
  );
}