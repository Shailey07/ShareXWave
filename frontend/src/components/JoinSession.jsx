import React, { useState, useEffect } from 'react';
import { joinRoom, joinById, setRoomToken } from '../api';
import QRScanner from './QRScanner';

export default function JoinSession({ onSessionJoined, prefill }) {
  const [yourName, setYourName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('code');

  useEffect(() => {
    if (prefill?.code) setCode(prefill.code);
    if (prefill?.password) setPassword(prefill.password);
  }, [prefill]);

  const handleSubmit = async (overrideCode, overridePassword, overrideRoomId) => {
    if (!yourName.trim()) { setError('// apna naam daalo'); return; }
    const finalCode = (overrideCode || code).toUpperCase();
    const finalPass = overridePassword || password;
    setLoading(true);
    setError('');
    try {
      let res;
      if (overrideRoomId) res = await joinById(overrideRoomId, finalPass);
      else                res = await joinRoom({ code: finalCode, password: finalPass });
      setRoomToken(res.data.token);
      onSessionJoined({ ...res.data, myName: yourName.trim() }, false);
    } catch (err) {
      const s = err.response?.status;
      setError(
        s === 410 ? '// session expired' :
        s === 401 ? '// incorrect password' :
        s === 429 ? '// too many attempts — wait a minute' :
        '// invalid code or password'
      );
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'scan') {
    return (
      <div>
        <QRScanner onScan={(c, p, r) => handleSubmit(c, p, r)} />
        <button onClick={() => setMode('code')} className="ice-btn btn-ghost" style={{ marginTop: 12 }}>← Back</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="field-label">Your Name (shown in chat)</label>
        <input className="ice-input" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Rahul" maxLength={24} />
      </div>
      <div>
        <label className="field-label">Session Code</label>
        <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="A12ES4" maxLength={6} className="ice-input" style={{ textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: 700 }} />
      </div>
      <div>
        <label className="field-label">Password</label>
        <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Xy9QzAbc" className="ice-input" style={{ letterSpacing: 2 }} />
      </div>
      {error && <p className="text-error">{error}</p>}
      <button onClick={() => handleSubmit()} disabled={loading || !yourName.trim() || !code || !password} className="ice-btn btn-teal">
        {loading ? '⟳ Connecting...' : '▶ Access Session'}
      </button>
      <div className="or-divider"><span className="or-text">or</span></div>
      <button onClick={() => setMode('scan')} className="ice-btn btn-lavender">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="#fff" strokeWidth="1" />
          <rect x="8" y="1" width="4" height="4" rx="0.8" stroke="#fff" strokeWidth="1" />
          <rect x="1" y="8" width="4" height="4" rx="0.8" stroke="#fff" strokeWidth="1" />
          <line x1="8" y1="8" x2="12" y2="8" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="8" x2="8" y2="12" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </svg>
        Scan QR Code
      </button>
    </div>
  );
}