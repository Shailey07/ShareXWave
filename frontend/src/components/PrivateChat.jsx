import React, { useState } from 'react';
import { createPrivate, joinRoom, setRoomToken } from '../api';

const Icons = {
  Lock: ({ size = 14, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Login: ({ size = 14, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
};

export default function PrivateChat({ onJoined }) {
  const [mode, setMode]                   = useState('create');
  const [yourName, setYourName]           = useState('');
  const [gmail, setGmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const create = async () => {
    if (!yourName.trim()) { setError('// apna naam daalo'); return; }
    setLoading(true); setError('');
    try {
      await createPrivate({ gmail, password, displayName, creatorName: yourName.trim() });
      const j = await joinRoom({ gmail, password });
      setRoomToken(j.data.token);
      onJoined({ ...j.data, myName: yourName.trim() });
    } catch (e) {
      setError(e.response?.data?.error || '// failed');
    } finally { setLoading(false); }
  };

  const join = async () => {
    if (!yourName.trim()) { setError('// apna naam daalo'); return; }
    setLoading(true); setError('');
    try {
      const res = await joinRoom({ gmail, password });
      setRoomToken(res.data.token);
      onJoined({ ...res.data, myName: yourName.trim() });
    } catch (e) {
      const s = e.response?.status;
      setError(
        s === 401 ? '// incorrect password' :
        s === 404 ? '// ID not found or expired' :
        '// failed'
      );
    } finally { setLoading(false); }
  };

  const isCreate = mode === 'create';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMode('create')} className={`ice-btn ${isCreate ? 'btn-ice' : 'btn-ghost'}`} style={{ flex: 1 }}>Create</button>
        <button onClick={() => setMode('join')}   className={`ice-btn ${!isCreate ? 'btn-ice' : 'btn-ghost'}`} style={{ flex: 1 }}>Join</button>
      </div>

      <div>
        <label className="field-label">Your Name (shown in chat)</label>
        <input className="ice-input" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Shailendra" maxLength={24} />
      </div>

      <div>
        <label className="field-label">Gmail ID (used only as unique identifier)</label>
        <input className="ice-input" type="email" value={gmail} onChange={e => setGmail(e.target.value)} placeholder="you@gmail.com" />
      </div>

      {isCreate && (
        <div>
          <label className="field-label">Room Name (optional)</label>
          <input className="ice-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
        </div>
      )}

      <div>
        <label className="field-label">ShareXWave Password (NOT your Gmail password)</label>
        <input className="ice-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>

      <p style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', lineHeight: 1.7 }}>
        // Gmail is only a unique ID — we never access your inbox.<br />
        // This ID expires in 24 hours. No permanent account.
      </p>

      {error && <p className="text-error">{error}</p>}

      <button onClick={isCreate ? create : join} disabled={loading || !yourName.trim() || !gmail || !password} className="ice-btn btn-ice">
        {loading ? '⟳ ...' : isCreate ? (
          <>
            <Icons.Lock size={14} color="#fff" />
            Create Private ID
          </>
        ) : (
          <>
            <Icons.Login size={14} color="#fff" />
            Join Private Chat
          </>
        )}
      </button>
    </div>
  );
}