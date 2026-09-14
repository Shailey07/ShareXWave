import { sendOffer, sendAnswer, sendIce } from './socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export function createPeer({ remotePeerId, onIce, onTrack, onStateChange }) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

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
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return pc.localDescription;
}

export async function setAnswer(pc, answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIce(pc, candidate) {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.warn('[WebRTC] addIce failed:', e.message);
  }
}