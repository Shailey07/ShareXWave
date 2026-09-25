import { io } from 'socket.io-client';
import { getAccountToken } from './api';

let socket = null;

export function connectSocket({ roomId, token, displayName, accountToken, handlers }) {
  if (socket) socket.disconnect();

  const SOCKET_URL = import.meta.env.VITE_API_URL || '/';
socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
    const acct = accountToken ?? getAccountToken();
    socket.emit('auth', { roomId, token, displayName, accountToken: acct }, (res) => {
      if (!res?.ok) return handlers.onError?.(res?.error || 'Auth failed');
      // Approval-required room and we're not the owner → wait for the host.
      if (res.pending) return handlers.onPending?.(res);
      handlers.onReady?.(res);
    });
  });

  socket.on('connect_error', (e) => console.error('[socket] connect_error', e.message));

  socket.on('message:new', (m) => handlers.onMessage?.(m));
  socket.on('clipboard:updated', ({ text }) => handlers.onClipboard?.(text));
  socket.on('member-joined', (p) => handlers.onMemberJoined?.(p));
  socket.on('member-left', (p) => handlers.onMemberLeft?.(p));
  socket.on('members-updated', (p) => handlers.onMembers?.(p.members));
  socket.on('file-added', (p) => handlers.onFileAdded?.(p));
  socket.on('file-deleted', (p) => handlers.onFileDeleted?.(p));
  socket.on('typing', (p) => handlers.onTyping?.(p));
  socket.on('room-expired', () => handlers.onExpired?.());
  socket.on('session:extended', (p) => handlers.onExtended?.(p));

  /* ─── Join-approval (host side) ─── */
  socket.on('join:request', (p) => handlers.onJoinRequest?.(p.request));
  socket.on('join:pending-list', (p) => handlers.onPendingList?.(p.pending || []));

  /* ─── Join-approval (waiting joiner side) ─── */
  socket.on('join:approved', () => {
    // Owner let us in — finalize our own admission, then go live.
    socket.emit('join:finalize', {}, (res) => {
      if (!res?.ok) return handlers.onError?.(res?.error || 'Join failed');
      handlers.onReady?.(res);
    });
  });
  socket.on('join:rejected', (p) => handlers.onRejected?.(p?.reason || 'declined'));

  socket.on('call:incoming', (p) => handlers.onCallIncoming?.(p));
  socket.on('call:accepted', (p) => handlers.onCallAccepted?.(p));
  socket.on('call:rejected', (p) => handlers.onCallRejected?.(p));
  socket.on('call:ended', (p) => handlers.onCallEnded?.(p));
  socket.on('webrtc:offer', (p) => handlers.onOffer?.(p));
  socket.on('webrtc:answer', (p) => handlers.onAnswer?.(p));
  socket.on('webrtc:ice', (p) => handlers.onIce?.(p));

  socket.on('disconnect', () => handlers.onDisconnect?.());

  return socket;
}

export const sendMessage      = (text, attachment) => socket?.emit('message:send', { text, attachment });
export const sendClipboard    = (text)             => socket?.emit('clipboard:update', { text });
export const setTyping        = (isTyping)         => socket?.emit('typing', { isTyping });
export const callInvite       = (kind)             => socket?.emit('call:invite', { kind });
export const callAccept       = (to)               => socket?.emit('call:accept', { to });
export const callReject       = (to)               => socket?.emit('call:reject', { to });
export const callEnd          = (to, kind, duration) => socket?.emit('call:end', { to, kind, duration });
export const sendOffer        = (to, sdp)          => socket?.emit('webrtc:offer', { to, sdp });
export const sendAnswer       = (to, sdp)          => socket?.emit('webrtc:answer', { to, sdp });
export const sendIce          = (to, candidate)    => socket?.emit('webrtc:ice', { to, candidate });
/* Host approves / rejects a waiting joiner. */
export const approveJoin      = (socketId)         => socket?.emit('join:approve', { socketId });
export const rejectJoin       = (socketId)         => socket?.emit('join:reject', { socketId });
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
export const getSocketId      = () => socket?.id;
