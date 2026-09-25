import { sendIce } from './socket';

/*
 * ICE servers.
 * Google STUN handles same-network / friendly-NAT calls. For calls across
 * mobile data or strict/symmetric NATs you MUST provide a TURN server — set
 * these in the frontend env (e.g. on Vercel) and they'll be used automatically:
 *   VITE_TURN_URL         e.g. turn:your.turn.host:3478  (comma-separate multiple)
 *   VITE_TURN_USERNAME
 *   VITE_TURN_CREDENTIAL
 * Without TURN, some peers simply cannot connect no matter how good the code is.
 */
const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

const TURN = import.meta.env.VITE_TURN_URL
  ? [{
      urls: import.meta.env.VITE_TURN_URL.split(',').map(s => s.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    }]
  : [];

const ICE_SERVERS = {
  iceServers: [...STUN, ...TURN],
  iceCandidatePoolSize: 10,
};

export function createPeer({ remotePeerId, onIce, onTrack, onStateChange }) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // Remote ICE candidates that arrive before setRemoteDescription() must be
  // buffered — adding them early throws and the candidate is lost, which is a
  // common reason calls "connect" but never get audio/video.
  pc._pendingCandidates = [];

  pc.onicecandidate = (e) => {
    if (e.candidate && remotePeerId) {
      sendIce(remotePeerId, e.candidate.toJSON());
    }
    onIce?.(e.candidate);
  };

  pc.ontrack = (e) => {
    console.log('[WebRTC] got remote track', e.track.kind);
    if (e.streams && e.streams[0]) onTrack?.(e.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    console.log('[WebRTC] connection state:', pc.connectionState);
    onStateChange?.(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ice state:', pc.iceConnectionState);
  };

  return pc;
}

export async function getMedia(kind) {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: kind === 'video'
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      : false,
  };
  console.log('[WebRTC] requesting media:', constraints);
  return await navigator.mediaDevices.getUserMedia(constraints);
}

export async function createOffer(pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return pc.localDescription;
}

export async function createAnswer(pc, offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  await flushCandidates(pc);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return pc.localDescription;
}

export async function setAnswer(pc, answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  await flushCandidates(pc);
}

export async function addIce(pc, candidate) {
  if (!pc || !candidate) return;
  // Queue until the remote description exists, otherwise addIceCandidate throws.
  if (!pc.remoteDescription || !pc.remoteDescription.type) {
    pc._pendingCandidates.push(candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.warn('[WebRTC] addIce failed:', e.message);
  }
}

async function flushCandidates(pc) {
  if (!pc?._pendingCandidates?.length) return;
  const list = pc._pendingCandidates.splice(0);
  for (const c of list) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch (e) {
      console.warn('[WebRTC] flush ice failed:', e.message);
    }
  }
}
