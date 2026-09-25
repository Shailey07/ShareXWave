import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScan }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError]       = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualPass, setManualPass] = useState('');
  const ref = useRef(null);

  const parseQR = (raw) => {
    try {
      const j = JSON.parse(raw);
      if (j.c && j.p) return { code: j.c, password: j.p, roomId: j.r };
    } catch {}
    const idx = raw.indexOf(':');
    if (idx > 0) return { code: raw.slice(0, idx), password: raw.slice(idx + 1) };
    return { roomId: raw };
  };

  const start = async () => {
    setScanning(true); setError('');
    await new Promise(r => setTimeout(r, 100));
    try {
      const s = new Html5Qrcode('qr-reader');
      ref.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          s.stop().then(() => s.clear()).catch(() => {});
          setScanning(false);
          const p = parseQR(text);
          if (p.code && p.password) onScan(p.code, p.password, null);
          else if (p.roomId)        onScan(null, null, p.roomId);
          else setError('// invalid QR');
        },
        () => {}
      );
    } catch (e) { setError('// camera error: ' + e.message); setScanning(false); }
  };

  const stop = async () => {
    try { await ref.current?.stop(); await ref.current?.clear(); } catch {}
    setScanning(false);
  };

  if (scanning) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ position: 'relative', border: '0.5px solid var(--border-mid)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'rgba(0,0,0,0.5)', minHeight: 260 }}>
        <div className="scan-corner tl" /><div className="scan-corner tr" />
        <div className="scan-corner bl" /><div className="scan-corner br" />
        <div className="scan-line" />
        <div id="qr-reader" style={{ width: '100%' }} />
      </div>
      <button onClick={stop} className="ice-btn btn-danger">✕ Cancel</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button onClick={start} className="ice-btn btn-lavender">📷 Open Camera & Scan</button>
      <div className="or-divider"><span className="or-text">or enter manually</span></div>
      <div>
        <label className="field-label">Session Code</label>
        <input className="ice-input" value={manualCode}
          onChange={e => setManualCode(e.target.value.toUpperCase())}
          placeholder="A12ES4" maxLength={6}
          style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: 700 }} />
      </div>
      <div>
        <label className="field-label">Password</label>
        <input className="ice-input" type="text" value={manualPass}
          onChange={e => setManualPass(e.target.value)} placeholder="Xy9QzAbc" />
      </div>
      {error && <p className="text-error">{error}</p>}
      <button onClick={() => onScan(manualCode.trim().toUpperCase(), manualPass.trim(), null)}
        disabled={!manualCode.trim() || !manualPass.trim()}
        className="ice-btn btn-teal">▶ Join</button>
    </div>
  );
}