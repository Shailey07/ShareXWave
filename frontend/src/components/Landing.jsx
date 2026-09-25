import React from 'react';

export default function Landing({ onNavigate }) {
  return (
    <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }} className="fade-in">
      <h1 className="shimmer-text" style={{
        fontFamily: 'var(--font-d)', fontSize: 48, fontWeight: 900, letterSpacing: -1.5,
        marginTop: 20,
      }}>ClipShare</h1>
      <p className="slash-label" style={{ fontSize: 10, letterSpacing: 3 }}>share · chat · call · done</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 360, marginTop: 32 }}>
        <button onClick={() => onNavigate('create')} className="ice-btn btn-ice" style={{ padding: '16px', fontSize: 15 }}>
          ✦ Create Room
        </button>
        <button onClick={() => onNavigate('join')} className="ice-btn btn-teal" style={{ padding: '16px', fontSize: 15 }}>
          ▶ Join Room
        </button>
        <button onClick={() => onNavigate('private')} className="ice-btn btn-lavender" style={{ padding: '16px', fontSize: 15 }}>
          🔒 Private Chat ID
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 32 }}>
        <span className="chip chip-ice">✦ Anonymous</span>
        <span className="chip chip-teal">⚡ Real-time</span>
        <span className="chip chip-lavender">⧗ 1h rooms</span>
        <span className="chip chip-amber">⇅ 2GB files</span>
      </div>

      <p className="slash-label" style={{ marginTop: 40, textAlign: 'center', lineHeight: 2 }}>
        // no signup · no phone · auto-expire<br />
        // files, chat & calls — instant sync
      </p>
    </div>
  );
}