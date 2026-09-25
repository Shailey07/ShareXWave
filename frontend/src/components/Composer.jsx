import React, { useRef, useState } from 'react';

/* ─── Professional SVG Icons ─── */
const AttachIcons = {
  File: ({ size = 18, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
  Image: ({ size = 18, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Video: ({ size = 18, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Audio: ({ size = 18, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  Document: ({ size = 18, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  Plus: ({ size = 20, color = '#6c63ff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Send: ({ size = 18, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
};

const ATTACH_OPTIONS = [
  { label: 'File',     key: 'File',     accept: '*/*',                                            Ic: AttachIcons.File },
  { label: 'Image',    key: 'Image',    accept: 'image/*',                                        Ic: AttachIcons.Image },
  { label: 'Video',    key: 'Video',    accept: 'video/*',                                        Ic: AttachIcons.Video },
  { label: 'Audio',    key: 'Audio',    accept: 'audio/*',                                        Ic: AttachIcons.Audio },
  { label: 'Document', key: 'Document', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md',  Ic: AttachIcons.Document },
];

export default function Composer({ onSend, onFile, disabled }) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const grow = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    setText(e.target.value);
  };

  const onPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onFile(file);
        return;
      }
    }
  };

  return (
    <div className="composer" style={{ position: 'relative' }}>
      {/* ── Attach button ── */}
      <button
        onClick={() => setShowAttach(v => !v)}
        title="Attach file"
        style={{
          width: 40, height: 40, padding: 0, borderRadius: '50%',
          border: '1.5px solid var(--border-mid)',
          background: showAttach ? 'var(--violet-faint)' : 'rgba(255,255,255,0.9)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          transform: showAttach ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        <AttachIcons.Plus size={20} color="#6c63ff" />
      </button>

      {/* ── Attach menu ── */}
      {showAttach && (
        <>
          {/* invisible overlay to close menu */}
          <div
            onClick={() => setShowAttach(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div style={{
            position: 'absolute', bottom: 70, left: 14,
            background: '#ffffff',
            borderRadius: 14,
            boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
            padding: 8,
            display: 'flex', flexDirection: 'column', gap: 2,
            border: '1px solid var(--border-mid)',
            zIndex: 100,
            minWidth: 170,
          }}>
            {ATTACH_OPTIONS.map(({ label, accept, Ic }) => (
              <button
                key={label}
                onClick={() => { fileRef.current.accept = accept; fileRef.current.click(); setShowAttach(false); }}
                style={{
                  background: 'none', border: 'none',
                  textAlign: 'left', padding: '10px 14px', borderRadius: 10,
                  cursor: 'pointer', fontSize: 13,
                  fontFamily: 'var(--font-d)', fontWeight: 500,
                  color: 'var(--t1)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--violet-faint)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--violet-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Ic size={16} color="#6c63ff" />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }}
      />

      <textarea
        ref={inputRef}
        value={text}
        onChange={grow}
        onKeyDown={onKey}
        onPaste={onPaste}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
      />

      {/* ── Send button ── */}
      <button
        onClick={submit}
        disabled={!text.trim() || disabled}
        title="Send"
        style={{
          width: 40, height: 40, padding: 0, borderRadius: '50%',
          border: 'none',
          background: text.trim() ? 'linear-gradient(135deg, #7c6fff, #6c63ff)' : 'rgba(108,99,255,0.35)',
          boxShadow: text.trim() ? '0 4px 14px rgba(108,99,255,0.35)' : 'none',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        <AttachIcons.Send size={18} color="#fff" />
      </button>
    </div>
  );
}