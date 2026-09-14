import React, { useState } from 'react';
import QRCode from 'react-qr-code';

export default function QRCodeModal({ roomId, code, password, qrCode, onClose }) {
  const [copied, setCopied] = useState(null);

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const shareUrl = `${window.location.origin}/?r=${roomId}&p=${encodeURIComponent(password)}`;
  const qrPayload = JSON.stringify({ c: code, p: password, r: roomId });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(20,15,50,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>
          Share Session
        </h3>
        <p className="slash-label" style={{ marginBottom: 20 }}>
          scan or copy credentials
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ padding: 14, background: '#ffffff', borderRadius: 14, border: '1.5px solid var(--border-mid)' }}>
            <QRCode value={qrPayload} size={170} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Session Code', value: code, key: 'code' },
            { label: 'Password', value: password, key: 'pass' },
          ].map(({ label, value, key }) => (
            <div
              key={key}
              style={{
                background: '#f8faff',
                border: '1.5px solid var(--border-mid)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-m)', fontSize: 8, color: 'var(--t3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-m)', fontSize: 14, fontWeight: 700, color: 'var(--t1)', letterSpacing: 1 }}>
                  {value}
                </div>
              </div>
              <button
                onClick={() => copy(value, key)}
                style={{
                  padding: '5px 12px',
                  fontSize: 10,
                  border: '1px solid var(--border-mid)',
                  background: '#ede9fe',
                  color: '#6c63ff',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copied === key ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => copy(shareUrl, 'link')}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: 13,
            border: 'none',
            background: '#a78bfa',
            color: '#ffffff',
            borderRadius: 10,
            cursor: 'pointer',
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          {copied === 'link' ? '✓ Link Copied' : '🔗 Copy Share Link'}
        </button>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: 13,
            border: '1.5px solid var(--border-mid)',
            background: '#f8faff',
            color: '#64748b',
            borderRadius: 10,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}