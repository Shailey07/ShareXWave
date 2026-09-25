import React, { useEffect, useRef, useState } from 'react';

/* ─── Professional SVG Icons ─── */
const Icons = {
  Phone: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Video: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Mic: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  MicOff: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  Camera: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  CameraOff: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  PhoneOff: ({ size = 22, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  ),
  Expand: ({ size = 16, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ),
};

export default function CallOverlay({
  call, localStream, remoteStream,
  onAccept, onReject, onEnd, onToggleMute, onToggleCamera,
}) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const stageRef = useRef(null);
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0, w: 0, h: 0, pid: null });

  // WhatsApp-style layout: one video fills the screen, the other floats as a
  // small tile. swapped=false → remote is the big view, local is the floating
  // PiP. Tap the floating tile to swap which one is big.
  const [swapped, setSwapped] = useState(false);
  const [pipPos, setPipPos] = useState(null); // {x,y} once the PiP has been dragged

  useEffect(() => { if (localRef.current && localStream) localRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream; }, [remoteStream]);
  // Reset the layout whenever we leave the active video screen (call ended / incoming).
  useEffect(() => { if (!call || call.incoming) { setSwapped(false); setPipPos(null); } }, [call?.incoming, !!call]);

  const swapViews = () => setSwapped((s) => !s);

  const onPipDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = {
      active: true, moved: false,
      sx: e.clientX, sy: e.clientY,
      ox: r.left, oy: r.top, w: r.width, h: r.height,
      pid: e.pointerId,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPipMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return; // jitter → still a tap
    d.moved = true;
    const s = stageRef.current
      ? stageRef.current.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const x = Math.max(8, Math.min(d.ox - s.left + dx, s.width - d.w - 8));
    const y = Math.max(8, Math.min(d.oy - s.top + dy, s.height - d.h - 8));
    setPipPos({ x, y });
  };
  const onPipUp = (e) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d.moved) swapViews(); // released without dragging → treat as a tap → swap
  };

  if (!call) return null;

  const { state, kind, peerName, duration, muted, cameraOff, incoming, error } = call;
  const mm = String(Math.floor((duration || 0) / 60)).padStart(2, '0');
  const ss = String((duration || 0) % 60).padStart(2, '0');

  /* ── Incoming call screen ── */
  if (incoming) {
    return (
      <div className="call-overlay">
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6c63ff, #3da9fc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, fontWeight: 800,
          boxShadow: '0 20px 60px rgba(108,99,255,0.45)',
          marginBottom: 10,
        }}>
          {(peerName || 'G').charAt(0).toUpperCase()}
        </div>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {peerName || 'Guest'}
        </h2>
        <p style={{ fontFamily: 'var(--font-m)', fontSize: 11, opacity: 0.7, letterSpacing: 2 }}>
          INCOMING {kind === 'video' ? 'VIDEO' : 'VOICE'} CALL
        </p>

        <div className="call-controls" style={{ marginTop: 20 }}>
          <button className="call-btn end" onClick={onReject} title="Decline">
            <Icons.PhoneOff size={22} color="#fff" />
          </button>
          <button
            className="call-btn"
            style={{ background: '#2ec4b6' }}
            onClick={onAccept}
            title="Accept"
          >
            {kind === 'video' ? <Icons.Video size={22} color="#fff" /> : <Icons.Phone size={22} color="#fff" />}
          </button>
        </div>
      </div>
    );
  }

  /* ── Active call screen ── */
  return (
    <div className="call-overlay" style={{ padding: 0 }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: 16, textAlign: 'center', zIndex: 3,
      }}>
        <div style={{ fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700 }}>
          {peerName || 'Guest'}
        </div>
        <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, opacity: 0.75, marginTop: 4 }}>
          {state === 'connected' ? `${mm}:${ss}` : state}
        </div>
      </div>

      {kind === 'video' ? (
        <div className="video-stage" ref={stageRef}>
          {/* Remote (the other person) — big by default */}
          <div
            className={`vtile ${swapped ? 'pip' : 'main'}`}
            style={swapped && pipPos ? { left: pipPos.x, top: pipPos.y, right: 'auto', bottom: 'auto' } : undefined}
            onPointerDown={swapped ? onPipDown : undefined}
            onPointerMove={swapped ? onPipMove : undefined}
            onPointerUp={swapped ? onPipUp : undefined}
          >
            <video ref={remoteRef} autoPlay playsInline />
            {!remoteStream && <div className="vtile-note">Waiting for video…</div>}
            {swapped && (
              <>
                <span className="pip-hint"><Icons.Expand size={15} color="#fff" /></span>
                <span className="pip-tag">{peerName || 'Guest'}</span>
              </>
            )}
          </div>

          {/* Local (you) — floating PiP by default */}
          <div
            className={`vtile ${swapped ? 'main' : 'pip'}`}
            style={!swapped && pipPos ? { left: pipPos.x, top: pipPos.y, right: 'auto', bottom: 'auto' } : undefined}
            onPointerDown={!swapped ? onPipDown : undefined}
            onPointerMove={!swapped ? onPipMove : undefined}
            onPointerUp={!swapped ? onPipUp : undefined}
          >
            <video ref={localRef} autoPlay playsInline muted
              style={{ visibility: cameraOff ? 'hidden' : 'visible' }} />
            {cameraOff && (
              <div className="vtile-note vtile-camoff"><Icons.CameraOff size={swapped ? 40 : 30} color="#fff" /></div>
            )}
            {!swapped && (
              <>
                <span className="pip-hint"><Icons.Expand size={15} color="#fff" /></span>
                <span className="pip-tag">You</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 140, height: 140, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6c63ff, #3da9fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 56, fontWeight: 800,
            boxShadow: '0 20px 60px rgba(108,99,255,0.45)',
          }}>
            {(peerName || 'G').charAt(0).toUpperCase()}
          </div>
          <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute' }}>
            <video ref={remoteRef} autoPlay playsInline />
            <video ref={localRef} autoPlay playsInline muted />
          </div>
        </div>
      )}

      <div className="call-controls" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 3,
        background: 'linear-gradient(to top, rgba(8,6,30,0.85), transparent)',
        paddingTop: 40,
      }}>
        <button className="call-btn mute" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? <Icons.MicOff size={22} color="#fff" /> : <Icons.Mic size={22} color="#fff" />}
        </button>

        {kind === 'video' && (
          <button className="call-btn mute" onClick={onToggleCamera} title={cameraOff ? 'Turn camera on' : 'Turn camera off'}>
            {cameraOff ? <Icons.CameraOff size={22} color="#fff" /> : <Icons.Camera size={22} color="#fff" />}
          </button>
        )}

        <button className="call-btn end" onClick={onEnd} title="End call">
          <Icons.PhoneOff size={22} color="#fff" />
        </button>
      </div>

      {error && (
        <div style={{
          position: 'absolute', bottom: 100,
          color: '#f26b6b', fontFamily: 'var(--font-m)', fontSize: 11,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}