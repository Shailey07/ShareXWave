import React, { useState } from 'react';
import { signup, login, setAccountToken } from '../api';

/* Optional WhatsApp-style account modal.
   NO OTP — just name / gmail / password / confirm. Anonymous users never see this. */
export default function AuthModal({ onAuthed, onClose }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';

  const submit = async () => {
    setError('');
    const mail = gmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setError('// valid email daalo'); return; }
    if (password.length < 4 || password.length > 32) { setError('// password 4–32 characters ka ho'); return; }

    if (isSignup) {
      if (!name.trim()) { setError('// apna naam daalo'); return; }
      if (password !== confirmPassword) { setError('// dono password same nhi h'); return; }
      if (!agree) { setError('// pehle terms accept karo'); return; }
    }

    setLoading(true);
    try {
      const res = isSignup
        ? await signup({ name: name.trim(), gmail: mail, password, confirmPassword })
        : await login({ gmail: mail, password });
      setAccountToken(res.data.token);
      onAuthed?.(res.data.user);
    } catch (err) {
      const s = err.response?.status;
      const msg = err.response?.data?.error;
      setError(
        msg ? `// ${msg}` :
        s === 429 ? '// too many attempts — wait a minute' :
        '// connection failed — try again'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card glass-card" onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="slash-label" style={{ marginTop: 4 }}>
            {isSignup ? 'save your sessions · no OTP needed' : 'log in to see your saved sessions'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="auth-tabs">
          <button className={`auth-tab${!isSignup ? ' active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Log In</button>
          <button className={`auth-tab${isSignup ? ' active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {isSignup && (
            <div>
              <label className="field-label">Name</label>
              <input className="ice-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shailendra" maxLength={40} />
            </div>
          )}
          <div>
            <label className="field-label">Email</label>
            <input className="ice-input" type="email" value={gmail} onChange={e => setGmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="ice-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="4–32 characters" maxLength={32} autoComplete={isSignup ? 'new-password' : 'current-password'} />
          </div>
          {isSignup && (
            <div>
              <label className="field-label">Confirm Password</label>
              <input className="ice-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="re-type password" maxLength={32} autoComplete="new-password" />
            </div>
          )}

          {/* Consent / explanation — only on signup */}
          {isSignup && (
            <div className="auth-consent">
              <p style={{ fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>
                Account rakhne se kya hota hai:
              </p>
              <ul style={{ margin: 0, paddingLeft: 16, fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t3)', lineHeight: 1.8 }}>
                <li>Aap apni sessions & chats unke valid time tak (e.g. 24h) dubara dekh sakte ho.</li>
                <li>Expire hone se pehle session ko extend kar sakte ho.</li>
                <li>Files server par temporary rehti hain aur session expire hote hi delete ho jaati hain.</li>
                <li>Aap khud decide karte ho ki aapki session me kaun join karega (approval).</li>
              </ul>
              <label className="auth-agree">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <span>I understand and agree to the above.</span>
              </label>
            </div>
          )}

          {error && <p className="text-error" style={{ textAlign: 'center' }}>{error}</p>}

          <button onClick={submit} disabled={loading} className="ice-btn btn-ice">
            {loading ? '⟳ Please wait...' : (isSignup ? '✦ Create Account' : '▶ Log In')}
          </button>

          <p style={{ fontFamily: 'var(--font-m)', fontSize: 9.5, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.7 }}>
            {isSignup
              ? '// already have an account? tap Log In above'
              : '// no account? tap Sign Up — signup is optional, anonymous use still works'}
          </p>
        </div>
      </div>
    </div>
  );
}
