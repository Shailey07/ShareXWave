import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  connectSocket, sendMessage, sendClipboard, disconnectSocket,
  callInvite, callAccept, callReject, callEnd, getSocketId,
} from '../socket';
import { uploadFile, deleteFile, downloadFileUrl } from '../api';
import {
  createPeer, getMedia, createOffer, createAnswer, setAnswer, addIce,
} from '../webrtc';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import SharedText from './SharedText';
import FileUpload from './FileUpload';
import FileList from './FileList';
import CallOverlay from './CallOverlay';

const Icons = {
  Phone: ({ size = 16, color = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>),
  Video: ({ size = 16, color = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>),
  Close: ({ size = 16, color = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  Eye: ({ size = 12, color = '#f26b6b' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>),
  ArrowLeft: ({ size = 16, color = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
  Trash: ({ size = 14, color = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>),
  Users: ({ size = 14, color = 'var(--violet)' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  Key: ({ size = 12, color = 'var(--mint)' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>),
};

export default function ChatRoom({ session, onLeave }) {
  const isGhost = session.isGhost || false;

  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState(session.messages || []);
  const [text, setText] = useState(session.textContent || '');
  const [files, setFiles] = useState(session.files || []);
  const [totalBytes, setTotalBytes] = useState(session.totalBytes || 0);
  const [timeLeft, setTimeLeft] = useState('');
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState([]);
  const [typing, setTyping] = useState(null);
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const [showCreds, setShowCreds] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(null);

  const scrollRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const myIdRef = useRef(null);
  const callRef = useRef(null);

  useEffect(() => { callRef.current = call; }, [call]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  /* ── Countdown ── */
  useEffect(() => {
    const tick = () => {
      const rem = session.expiresAt - Date.now();
      if (rem <= 0) { setTimeLeft('Expired'); onLeave(); return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [session.expiresAt, onLeave]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, tab]);

  const startTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCall(c => c ? { ...c, state: 'connected' } : c);
    callTimerRef.current = setInterval(() => {
      setCall(c => c ? { ...c, duration: c.duration + 1 } : c);
    }, 1000);
  };

  const cleanupCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallError('');
  };

  /* ── Socket connect ── */
  useEffect(() => {
    const sock = connectSocket({
      roomId: session.roomId,
      token: session.token,
      displayName: session.myName || session.displayName,
      handlers: {
        onReady: (res) => {
          setConnected(true);
          setMessages(res.messages || []);
          setText(res.textContent || '');
          setFiles(res.files || []);
          setTotalBytes(res.totalBytes || 0);
          myIdRef.current = res.user?.id;
        },
        onError: (e) => console.error('socket auth error', e),
        onMessage: (m) => setMessages(prev => [...prev, m]),
        onClipboard: (t) => setText(t),
        onMembers: (m) => setMembers(m),
        onMemberJoined: (p) => setMessages(prev => [...prev, { id: `sys-${Date.now()}`, type: 'system', text: `${p.name} joined the room`, timestamp: Date.now() }]),
        onMemberLeft: (p) => setMessages(prev => [...prev, { id: `sys-${Date.now()}`, type: 'system', text: `${p.name || 'Someone'} left`, timestamp: Date.now() }]),
        onFileAdded: (p) => { setFiles(prev => [...prev, p.file]); setTotalBytes(p.totalBytes); },
        onFileDeleted: (p) => { setFiles(prev => prev.filter(f => f.id !== p.fileId)); setTotalBytes(p.totalBytes); },
        onTyping: (p) => { setTyping(p.isTyping ? p : null); setTimeout(() => setTyping(null), 2500); },
        onExpired: () => { alert('Session ended by admin or expired'); onLeave(); },
        onDisconnect: () => setConnected(false),

        onCallIncoming: (p) => setCall({ state: 'ringing', kind: p.kind, peerName: p.fromName, peerId: p.from, incoming: true, duration: 0, muted: false, cameraOff: false }),
        onCallAccepted: async (p) => {
          try {
            const kind = callRef.current?.kind || 'voice';
            const stream = await getMedia(kind);
            localStreamRef.current = stream; setLocalStream(stream);
            const pc = createPeer({ remotePeerId: p.from, onTrack: (s) => setRemoteStream(s), onStateChange: (st) => { if (st === 'connected') startTimer(); } });
            pcRef.current = pc;
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            const offer = await createOffer(pc);
            const { sendOffer } = await import('../socket');
            sendOffer(p.from, offer);
          } catch (e) { setCallError(e.message); cleanupCall(); setCall(null); }
        },
        onCallRejected: () => { cleanupCall(); setCall(null); },
        onCallEnded: () => { cleanupCall(); setCall(null); },
        onOffer: async (p) => {
          try {
            const kind = callRef.current?.kind || 'voice';
            const stream = await getMedia(kind);
            localStreamRef.current = stream; setLocalStream(stream);
            const pc = createPeer({ remotePeerId: p.from, onTrack: (s) => setRemoteStream(s), onStateChange: (st) => { if (st === 'connected') startTimer(); } });
            pcRef.current = pc;
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            const answer = await createAnswer(pc, p.sdp);
            const { sendAnswer } = await import('../socket');
            sendAnswer(p.from, answer);
            setCall(c => c ? { ...c, state: 'connecting', incoming: false } : c);
          } catch (e) { setCallError(e.message); cleanupCall(); setCall(null); }
        },
        onAnswer: async (p) => { try { if (pcRef.current) await setAnswer(pcRef.current, p.sdp); } catch {} },
        onIce: async (p) => { try { if (pcRef.current) await addIce(pcRef.current, p.candidate); } catch {} },
      },
    });
    return () => disconnectSocket();
  }, [session.roomId, session.token]);

  const handleSend = useCallback((t) => { if (isGhost) return; sendMessage(t, null); }, [isGhost]);

  const handleFileUpload = useCallback(async (file, onProgress) => {
    if (isGhost) return;
    const res = await uploadFile(session.roomId, file, onProgress);
    const meta = res.data.file;
    sendMessage('', { fileId: meta.id, originalName: meta.originalName, mimetype: meta.mimetype, size: meta.size });
  }, [session.roomId, isGhost]);

  const handleDownload = (fileId, name) => {
    const a = document.createElement('a');
    a.href = downloadFileUrl(session.roomId, fileId);
    a.download = name;
    a.click();
  };

  const handleDelete = async (fileId) => {
    if (isGhost) return;
    if (window.confirm('Delete this file?')) await deleteFile(session.roomId, fileId);
  };

  const handleEndSession = async () => {
    if (!window.confirm('End this session? All messages and files will be permanently deleted.')) return;
    try {
      const { adminDeleteRoom } = await import('../api');
      await adminDeleteRoom(session.roomId);
      onLeave();
    } catch (e) { alert('Delete failed: ' + (e.response?.data?.error || e.message)); }
  };

  const initiateCall = (kind) => {
    if (isGhost) return;
    setCallError('');
    setCall({ state: 'calling', kind, peerName: 'Guest', duration: 0, muted: false, cameraOff: false });
    callInvite(kind);
  };

  const acceptCall = () => { if (!call?.peerId) return; callAccept(call.peerId); setCall({ ...call, incoming: false, state: 'connecting' }); };
  const rejectCall = () => { if (call?.peerId) callReject(call.peerId); cleanupCall(); setCall(null); };
  const endCall = () => { if (call?.peerId) callEnd(call.peerId, call.kind, call.duration); cleanupCall(); setCall(null); };
  const toggleMute = () => { const a = localStreamRef.current?.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; setCall(c => ({ ...c, muted: !a.enabled })); } };
  const toggleCamera = () => { const v = localStreamRef.current?.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; setCall(c => ({ ...c, cameraOff: !v.enabled })); } };

  const roundBtn = (bg, shadow) => ({
    width: 38, height: 38, padding: 0, borderRadius: '50%',
    border: 'none', cursor: 'pointer', background: bg, boxShadow: shadow,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.15s ease', flexShrink: 0,
  });

  const memberCount = members.length || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div className="session-info-bar" style={isGhost ? { background: 'rgba(255,240,240,0.9)' } : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: isGhost ? 'rgba(242,107,107,0.12)' : 'var(--violet-faint)',
            border: `1px solid ${isGhost ? 'rgba(242,107,107,0.3)' : 'var(--border-mid)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
            color: isGhost ? 'var(--rose)' : 'var(--violet)', flexShrink: 0,
          }}>
            {(session.displayName || session.code || 'S').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.displayName || session.code || 'Room'}
              </span>
              {isGhost && (
                <span style={{
                  fontFamily: 'var(--font-m)', fontSize: 8, letterSpacing: 1.5,
                  background: 'rgba(242,107,107,0.15)', color: 'var(--rose)',
                  padding: '2px 8px', borderRadius: 20,
                  border: '1px solid rgba(242,107,107,0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                }}>
                  <Icons.Eye size={10} color="var(--rose)" /> GHOST
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: connected ? 'var(--mint)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{connected ? `● ${memberCount} connected` : '○ reconnecting...'}</span>
              {session.code && (
                <button
                  onClick={() => setShowCreds(v => !v)}
                  title="Show room credentials"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--violet)', fontFamily: 'var(--font-m)', fontSize: 9,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  <Icons.Key size={9} color="var(--violet)" />
                  {showCreds ? 'hide' : 'credentials'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowMembers(v => !v)}
            title="Members"
            style={{
              padding: '6px 10px', borderRadius: 8,
              background: 'var(--violet-faint)', border: '1px solid var(--border-mid)',
              color: 'var(--violet)', fontFamily: 'var(--font-m)', fontSize: 10, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icons.Users size={11} color="var(--violet)" />
            {memberCount}
          </button>

          {!isGhost && (
            <>
              <button onClick={() => initiateCall('voice')} title="Voice Call" style={roundBtn('linear-gradient(135deg, #4dd9c9 0%, #2ec4b6 100%)', '0 4px 12px rgba(46,196,182,0.35)')}>
                <Icons.Phone size={16} color="#fff" />
              </button>
              <button onClick={() => initiateCall('video')} title="Video Call" style={roundBtn('linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)', '0 4px 12px rgba(167,139,250,0.35)')}>
                <Icons.Video size={16} color="#fff" />
              </button>
            </>
          )}

          <div style={{
            fontFamily: 'var(--font-m)', fontSize: 12,
            color: isGhost ? 'var(--rose)' : 'var(--violet)',
            padding: '6px 10px', borderRadius: 8,
            background: isGhost ? 'rgba(242,107,107,0.1)' : 'var(--violet-faint)',
            fontWeight: 600, letterSpacing: 0.5, whiteSpace: 'nowrap',
          }}>
            {timeLeft}
          </div>

          {isGhost && (
            <button onClick={handleEndSession} title="End session"
              style={{
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(242,107,107,0.15)',
                border: '1px solid rgba(242,107,107,0.35)',
                color: 'var(--rose)',
                fontFamily: 'var(--font-m)', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap',
              }}>
              <Icons.Trash size={11} color="var(--rose)" /> End Session
            </button>
          )}

          <button onClick={onLeave} title={isGhost ? 'Back to Admin Panel' : 'Leave'}
            style={roundBtn(
              isGhost ? 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)' : 'linear-gradient(135deg, #fb8181 0%, #f26b6b 100%)',
              isGhost ? '0 4px 12px rgba(167,139,250,0.35)' : '0 4px 12px rgba(242,107,107,0.35)'
            )}>
            {isGhost ? <Icons.ArrowLeft size={16} color="#fff" /> : <Icons.Close size={16} color="#fff" />}
          </button>
        </div>
      </div>

      {/* ── Credentials panel (toggle) ── */}
      {showCreds && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(46,196,182,0.08)',
          borderBottom: '1px solid rgba(46,196,182,0.2)',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', letterSpacing: 1.5 }}>
            SHARE WITH OTHERS →
          </span>
          {session.code && (
            <div style={{
              fontFamily: 'var(--font-m)', fontSize: 11,
              background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border-mid)',
              padding: '5px 10px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: 'var(--t3)', letterSpacing: 1 }}>CODE</span>
              <b style={{ color: 'var(--violet)' }}>{session.code}</b>
              <button onClick={() => copy(session.code, 'code')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--violet)', fontSize: 10 }}>
                {copied === 'code' ? '✓' : 'Copy'}
              </button>
            </div>
          )}
          {session.roomPassword && (
            <div style={{
              fontFamily: 'var(--font-m)', fontSize: 11,
              background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border-mid)',
              padding: '5px 10px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: 'var(--t3)', letterSpacing: 1 }}>PASS</span>
              <b style={{ color: 'var(--mint)' }}>{session.roomPassword}</b>
              <button onClick={() => copy(session.roomPassword, 'pass')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mint)', fontSize: 10 }}>
                {copied === 'pass' ? '✓' : 'Copy'}
              </button>
            </div>
          )}
          <span style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)' }}>
            // anyone with these can join
          </span>
        </div>
      )}

      {/* ── Members panel (toggle) ── */}
      {showMembers && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(108,99,255,0.06)',
          borderBottom: '1px solid rgba(108,99,255,0.2)',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', letterSpacing: 1.5 }}>
            IN ROOM ({memberCount}) →
          </span>
          {members.map((m) => (
            <div key={m.id} style={{
              fontFamily: 'var(--font-m)', fontSize: 10,
              background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border-mid)',
              padding: '4px 10px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: m.id === myIdRef.current ? 'var(--violet)' : 'var(--mint)',
              }} />
              <b style={{ color: m.isCreator ? 'var(--violet)' : 'var(--t1)' }}>
                {m.name}
              </b>
              {m.isCreator && (
                <span style={{ fontSize: 8, color: 'var(--violet)', letterSpacing: 1 }}>CREATOR</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-mid)', background: 'rgba(255,255,255,0.6)' }}>
        {['chat', 'clipboard', 'files'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 1,
              color: tab === t ? 'var(--violet)' : 'var(--t3)',
              borderBottom: tab === t ? '2px solid var(--violet)' : '2px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {tab === 'chat' && (
        <>
          <div ref={scrollRef} className="chat-scroll">
            {messages.map(m => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={!isGhost && m.from === myIdRef.current}
                roomId={session.roomId}
              />
            ))}
            {typing && <div className="bubble system" style={{ opacity: 0.7 }}>{typing.name} is typing...</div>}
          </div>

          {!isGhost ? (
            <Composer onSend={handleSend} onFile={handleFileUpload} />
          ) : (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(242,107,107,0.05)',
              borderTop: '1px solid rgba(242,107,107,0.2)',
              textAlign: 'center',
              fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--rose)',
              letterSpacing: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icons.Eye size={12} color="var(--rose)" /> GHOST MODE — READ ONLY
            </div>
          )}
        </>
      )}

      {tab === 'clipboard' && (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <SharedText text={text} onChange={(t) => { if (isGhost) return; setText(t); sendClipboard(t); }} />
          {!isGhost && (
            <button onClick={() => { sendMessage(text, null); setTab('chat'); }} disabled={!text.trim()} className="ice-btn btn-ice" style={{ marginTop: 14 }}>
              📤 Send to Chat
            </button>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {!isGhost && (
            <FileUpload onUpload={handleFileUpload} totalBytes={totalBytes} maxBytes={session.maxBytes} disabled={totalBytes >= session.maxBytes} />
          )}
          <FileList files={files} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
      )}

      {call && (
        <CallOverlay call={{ ...call, error: callError }} localStream={localStream} remoteStream={remoteStream}
          onAccept={acceptCall} onReject={rejectCall} onEnd={endCall} onToggleMute={toggleMute} onToggleCamera={toggleCamera} />
      )}
    </div>
  );
}