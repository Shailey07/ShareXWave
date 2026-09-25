import React, { useState } from 'react';
import { createRoom, getAccountToken } from '../api';

export default function CreateSession({ onSessionCreated }) {
  const loggedIn = !!getAccountToken();
  const [yourName, setYourName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [ttl, setTtl] = useState(3600);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!yourName.trim()) { setError('// apna naam daalo'); return; }
    const pw = password.trim();
    if (pw && (pw.length < 4 || pw.length > 32)) {
      setError('// password 4–32 characters ka hona chahiye');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await createRoom({
        displayName, password, ttlMs: ttl * 1000, creatorName: yourName.trim(),
        // Only meaningful when logged in; backend ignores it for anonymous rooms.
        ...(loggedIn ? { approvalRequired } : {}),
      });
      onSessionCreated({ ...res.data, myName: yourName.trim() }, true);
    } catch (err) {
      console.error(err);
      setError('// connection failed — try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="field-label">Your Name (shown in chat)</label>
        <input className="ice-input" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Shailendra" maxLength={24} />
      </div>
      <div>
        <label className="field-label">Room Name (optional)</label>
        <input className="ice-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Meeting Notes" />
      </div>
      <div>
        <label className="field-label">Room Password (blank = auto-generate)</label>
        <input className="ice-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="4–32 chars, or leave blank" maxLength={32} />
      </div>
      <div>
        <label className="field-label">Expires In</label>
        <select className="ice-input" value={ttl} onChange={e => setTtl(Number(e.target.value))}>
          <option value={600}>10 minutes</option>
          <option value={1800}>30 minutes</option>
          <option value={3600}>1 hour (max)</option>
        </select>
      </div>

      {loggedIn && (
        <label className="approval-toggle">
          <input type="checkbox" checked={approvalRequired} onChange={e => setApprovalRequired(e.target.checked)} />
          <div>
            <span style={{ fontFamily: 'var(--font-d)', fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Require my approval to join</span>
            <span style={{ display: 'block', fontFamily: 'var(--font-m)', fontSize: 9.5, color: 'var(--t3)', marginTop: 2 }}>
              // jo bhi join karega, aapko accept/deny karna hoga
            </span>
          </div>
        </label>
      )}

      <button onClick={handle} disabled={loading || !yourName.trim()} className="ice-btn btn-ice">
        {loading ? (
          <span style={{ opacity: 0.7 }}>⟳ Generating...</span>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <path d="M6.5 1L8 4.5L12 5.3L9.5 7.8L10.1 12L6.5 10.2L2.9 12L3.5 7.8L1 5.3L5 4.5L6.5 1Z" stroke="#fff" strokeWidth="1.1" fill="none" />
            </svg>
            Generate New Session
          </>
        )}
      </button>

      {loading && <div className="loading-bar"><div className="loading-bar-inner" /></div>}
      {error && <p className="text-error" style={{ textAlign: 'center' }}>{error}</p>}

      <div style={{ borderLeft: '1.5px solid var(--border-mid)', paddingLeft: 14 }}>
        <p style={{ fontFamily: 'var(--font-m)', fontSize: 9.5, color: 'var(--t3)', lineHeight: 2, letterSpacing: '0.5px' }}>
          // Session expires after selected time<br />
          // Your name shows up in chat messages<br />
          // Share code + password to invite others
        </p>
      </div>
    </div>
  );
}