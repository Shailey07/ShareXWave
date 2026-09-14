import { io } from 'socket.io-client';

let socket = null;

export function connectSocket({ roomId, token, displayName, handlers }) {
  if (socket) socket.disconnect();

  socket = io('/', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
    socket.emit('auth', { roomId, token, displayName }, (res) => {
      if (!res?.ok) return handlers.onError?.(res?.error || 'Auth failed');
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
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
export const getSocketId      = () => socket?.id;