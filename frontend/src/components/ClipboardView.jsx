import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, sendMessage, sendClipboard, disconnectSocket,
         callInvite, callAccept, callReject, callEnd, getSocketId } from '../socket';
import { uploadFile, deleteFile, downloadFileUrl } from '../api';
import { createPeer, startCall, handleOffer, handleAnswer, handleIce } from '../webrtc';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import SharedText from './SharedText';
import FileUpload from './FileUpload';
import FileList from './FileList';
import CallOverlay from './CallOverlay';

export default function ChatRoom({ session, onLeave }) {
  const [tab, setTab]       = useState('chat');
  const [messages, setMessages] = useState(session.messages || []);
  const [text, setText]     = useState(session.textContent || '');
  const [files, setFiles]   = useState(session.files || []);
  const [totalBytes, setTotalBytes] = useState(session.totalBytes || 0);
  const [timeLeft, setTimeLeft] = useState('');
  const [connected, setConnected] = useState(false);
  const [members, setMembers]   = useState([]);
  const [typing, setTyping]     = useState(null);
  const [call, setCall]         = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const scrollRef = useRef(null);
  const peerRef   = useRef(null);
  const callTimerRef = useRef(null);
  const myIdRef   = useRef(null);

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

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, tab]);

  /* ── Socket connect ── */
  useEffect(() => {
    const sock = connectSocket({
      roomId: session.roomId,
      token: session.token,
      displayName: session.displayName,
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
        onMemberJoined: (p) => setMessages(prev => [...prev, { id: `sys-${Date.now()}`, type: 'system', text: `${p.name} joined`, timestamp: Date.now() }]),
        onMemberLeft:   (p) => setMessages(prev => [...prev, { id: `sys-${Date.now()}`, type: 'system', text: `Someone left`, timestamp: Date.now() }]),
        onFileAdded: (p) => { setFiles(prev => [...prev, p.file]); setTotalBytes(p.totalBytes); },
        onFileDeleted: (p) => { setFiles(prev => prev.filter(f => f.id !== p.fileId)); setTotalBytes(p.totalBytes); },
        onTyping: (p) => { setTyping(p.isTyping ? p : null); setTimeout(() => setTyping(null), 2500); },
        onExpired: () => { alert('Session expired'); onLeave(); },
        onDisconnect: () => setConnected(false),

        // Calls
        onCallIncoming: (p) => setCall({ state: 'ringing', kind: p.kind, peerName: p.fromName, peerId: p.from, incoming: true, duration: 0, muted: false, cameraOff: false }),
        onCallAccepted: async () => {
          // Callee accepted — send offer
          setCall(c => ({ ...c, state: 'connecting' }));
          const pc = createPeer({
            onIce: (c) => peerRef.current?.sendIce?.(c),
            onTrack: (stream) => setRemoteStream(stream),
            onStateChange: (st) => { if (st === 'connected') startTimer(); },
          });
          peerRef.current = { pc, sendIce: null };
          // Wire signaling after pc creation
        },
        onCallRejected: () => { cleanupCall(); setCall(null); },
        onCallEnded:    () => { cleanupCall(); setCall(null); },
        onOffer:  async (p) => {
          if (!peerRef.current) {
            const pc = createPeer({ onTrack: (s) => setRemoteStream(s), onStateChange: (st) => { if (st === 'connected') startTimer(); } });
            peerRef.current = { pc };
          }
          const stream = await handleOffer(peerRef.current.pc, p.from, p.sdp, call?.kind || 'voice');
          setLocalStream(stream);
        },
        onAnswer: async (p) => { if (peerRef.current) await handleAnswer(peerRef.current.pc, p.sdp); },
        onIce:    async (p) => { if (peerRef.current) await handleIce(peerRef.current.pc, p.candidate); },
      },
    });

    // Patch ICE sender
    const origCreate = peerRef.current;
    return () => disconnectSocket();
  }, [session.roomId, session.token]);

  const startTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCall(c => c ? { ...c, duration: c.duration + 1, state: 'connected' } : c);
    }, 1000);
  };

  const cleanupCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    localStream?.getTracks().forEach(t => t.stop());
    peerRef.current?.pc?.close();
    peerRef.current = null;
    setLocalStream(null); setRemoteStream(null);
  };

  /* ── Chat ── */
  const handleSend = useCallback((t) => {
    sendMessage(t, null);
  }, []);

  const handleFileUpload = useCallback(async (file, onProgress) => {
    const res = await uploadFile(session.roomId, file, onProgress);
    const meta = res.data.file;
    // Also send as chat message
    sendMessage('', {
      fileId: meta.id, originalName: meta.originalName,
      mimetype: meta.mimetype, size: meta.size,
    });
  }, [session.roomId]);

  const handleDownload = (fileId, name) => {
    const a = document.createElement('a');
    a.href = downloadFileUrl(session.roomId, fileId);
    a.download = name;
    a.click();
  };

  const handleDelete = async (fileId) => {
    if (window.confirm('Delete this file?')) await deleteFile(session.roomId, fileId);
  };

  /* ── Calls ── */
  const initiateCall = async (kind) => {
    setCall({ state: 'calling', kind, peerName: 'Guest', duration: 0, muted: false, cameraOff: false });
    callInvite(kind);
    const pc = createPeer({
      onTrack: (s) => setRemoteStream(s),
      onStateChange: (st) => { if (st === 'connected') startTimer(); },
    });
    peerRef.current = { pc };
    // Note: actual offer is sent after callee accepts (see onCallAccepted)
  };

  const acceptCall = async () => {
    if (!call) return;
    callAccept(call.peerId);
    // Callee doesn't create offer — waits for caller's offer
    setCall({ ...call, incoming: false, state: 'connecting' });
  };

  const rejectCall = () => {
    if (call?.peerId) callReject(call.peerId);
    cleanupCall(); setCall(null);
  };

  const endCall = () => {
    if (call?.peerId) callEnd(call.peerId, call.kind, call.duration);
    cleanupCall(); setCall(null);
  };

  const toggleMute = () => {
    const audio = localStream?.getAudioTracks()[0];
    if (audio) { audio.enabled = !audio.enabled; setCall(c => ({ ...c, muted: !audio.enabled })); }
  };

  const toggleCamera = () => {
    const video = localStream?.getVideoTracks()[0];
    if (video) { video.enabled = !video.enabled; setCall(c => ({ ...c, cameraOff: !video.enabled })); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="session-info-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ice-faint)', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--violet)' }}>
            {(session.code || session.displayName || 'S').charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{session.displayName || session.code || 'Room'}</div>
            <div style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: connected ? 'var(--mint)' : 'var(--amber)' }}>
              {connected ? `● ${members.length || 1} connected` : '○ reconnecting...'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => initiateCall('voice')} className="ice-btn btn-teal" style={{ width: 34, height: 34, padding: 0, borderRadius: '50%' }}>📞</button>
          <button onClick={() => initiateCall('video')} className="ice-btn btn-lavender" style={{ width: 34, height: 34, padding: 0, borderRadius: '50%' }}>📹</button>
          <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--violet)', marginLeft: 6 }}>{timeLeft}</div>
          <button onClick={onLeave} className="ice-btn btn-danger" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>✕</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-mid)', background: 'rgba(255,255,255,0.6)' }}>
        {['chat', 'clipboard', 'files'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
              color: tab === t ? 'var(--violet)' : 'var(--t3)',
              borderBottom: tab === t ? '2px solid var(--violet)' : '2px solid transparent' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'chat' && (
        <>
          <div ref={scrollRef} className="chat-scroll">
            {messages.map(m => <MessageBubble key={m.id} message={m} isOwn={m.from === myIdRef.current} roomId={session.roomId} />)}
            {typing && <div className="bubble system" style={{ opacity: 0.7 }}>{typing.name} is typing...</div>}
          </div>
          <Composer onSend={handleSend} onFile={handleFileUpload} />
        </>
      )}

      {tab === 'clipboard' && (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          <SharedText text={text} onChange={(t) => { setText(t); sendClipboard(t); }} />
          <button onClick={() => { sendMessage(text, null); setTab('chat'); }} disabled={!text.trim()}
            className="ice-btn btn-ice" style={{ marginTop: 14 }}>
            📤 Send to Chat
          </button>
        </div>
      )}

      {tab === 'files' && (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FileUpload onUpload={handleFileUpload} totalBytes={totalBytes} maxBytes={session.maxBytes}
            disabled={totalBytes >= session.maxBytes} />
          <FileList files={files} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
      )}

      {call && (
        <CallOverlay call={call} localStream={localStream} remoteStream={remoteStream}
          onAccept={acceptCall} onReject={rejectCall} onEnd={endCall}
          onToggleMute={toggleMute} onToggleCamera={toggleCamera} />
      )}
    </div>
  );
}