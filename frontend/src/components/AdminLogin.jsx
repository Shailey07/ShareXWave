import React, { useState } from 'react';
import { adminLogin, setAdminToken } from '../api';

export default function AdminLogin({ onLogin, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const res = await adminLogin(username, password);
      setAdminToken(res.data.token);
      onLogin(res.data);
    } catch (e) {
      const s = e.response?.status;
      setError(s === 401 ? '// invalid credentials' : s === 429 ? '// too many attempts' : '// login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: '14px 16px 24px', width: '100%' }} className="fade-in">
      <div className="glass-card card-3d" style={{ padding: '24px 20px', width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #f26b6b, #e05555)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(242,107,107,0.35)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>Admin Access</h2>
            <p className="slash-label">restricted area</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Username</label>
            <input className="ice-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoComplete="off" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="ice-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          {error && <p className="text-error">{error}</p>}
          <button onClick={submit} disabled={loading || !username || !password} className="ice-btn btn-danger">
            {loading ? '⟳ Authenticating...' : '🔐 Login'}
          </button>
          {onBack && <button onClick={onBack} className="ice-btn btn-ghost">← Back to Home</button>}
        </div>
      </div>
    </div>
  );
}