import { findRoomById, getMessages, getFiles, addMessage, setRoomText, addRoomMember } from './db.js';
import { validateToken, validateAccountToken } from './auth.js';

// In-memory member tracking per room
const roomMembers = new Map(); // roomId -> Map<socketId, {id, name, isCreator, isOwner}>
// Sockets belonging to the room owner (a logged-in account). Used to route approvals.
const roomOwners  = new Map(); // roomId -> Set<socketId>
// People waiting to be let in (approval-required rooms only).
const pendingJoins = new Map(); // roomId -> Map<socketId, {id, name, accUserId, requestedAt}>

function getMembers(roomId) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  return [...roomMembers.get(roomId).values()];
}
function ownerSet(roomId) {
  if (!roomOwners.has(roomId)) roomOwners.set(roomId, new Set());
  return roomOwners.get(roomId);
}
function pendingMap(roomId) {
  if (!pendingJoins.has(roomId)) pendingJoins.set(roomId, new Map());
  return pendingJoins.get(roomId);
}
function getPending(roomId) {
  return [...pendingMap(roomId).values()];
}
function emitToOwners(io, roomId, event, payload) {
  for (const sid of ownerSet(roomId)) io.to(sid).emit(event, payload);
}

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    let roomId = null;
    let userName = null;
    let role = 'user';
    let roomExpiresAt = 0;
    let accUserId = null;    // set if the socket authenticated with an account token
    let isOwner = false;     // this socket is the room's account-owner
    let approved = false;    // gated: only approved sockets may chat / call

    // Fully admit a socket into the room (join, track, hydrate). Returns the
    // payload the client needs. Used for direct joins AND owner-approved joins.
    async function admitSocket(rid, room) {
      socket.join(rid);
      approved = true;

      const members = getMembers(rid);
      const memberInfo = { id: socket.id, name: userName, isCreator: isOwner || members.length === 0, isOwner };
      roomMembers.get(rid).set(socket.id, memberInfo);

      if (isOwner) ownerSet(rid).add(socket.id);
      // Record a logged-in joiner as a member of the room for their "My Sessions".
      if (accUserId && !isOwner) await addRoomMember(rid, accUserId).catch(() => {});

      const [messages, files] = await Promise.all([getMessages(rid), getFiles(rid)]);
      return {
        ok: true,
        user: { id: socket.id, name: userName, role },
        isOwner,
        messages,
        textContent: room.textContent || '',
        files,
        totalBytes: Number(room.totalBytes || 0),
        maxBytes: Number(room.maxBytes || 0),
      };
    }

    function announceJoin(rid) {
      socket.to(rid).emit('member-joined', { id: socket.id, name: userName });
      io.to(rid).emit('members-updated', { members: getMembers(rid) });
    }

    socket.on('auth', async ({ roomId: rid, token, displayName, accountToken }, cb) => {
      try {
        const payload = validateToken(token);
        if (!payload) return cb?.({ ok: false, error: 'Invalid token' });

        const isAdmin = payload.role === 'admin';
        if (!isAdmin && payload.roomId !== rid) return cb?.({ ok: false, error: 'Unauthorized' });

        const room = await findRoomById(rid);
        if (!room || Number(room.expiresAt) <= Date.now()) return cb?.({ ok: false, error: 'Expired' });

        roomId = rid;
        roomExpiresAt = Number(room.expiresAt);
        role = isAdmin ? 'admin' : 'user';
        userName = isAdmin ? 'Winterwolf' : (displayName || 'Guest');

        // Optional account identity — enables ownership + approval routing.
        const acc = validateAccountToken(accountToken);
        accUserId = acc?.userId || null;
        isOwner = !isAdmin && !!room.ownerUserId && accUserId === room.ownerUserId;

        const approvalRequired = !!room.approvalRequired;

        // Admin never occupies a member slot and bypasses approval (read-only oversight).
        if (isAdmin) {
          socket.join(rid);
          approved = true;
          const [messages, files] = await Promise.all([getMessages(rid), getFiles(rid)]);
          return cb?.({
            ok: true, user: { id: socket.id, name: userName, role },
            messages, textContent: room.textContent || '', files,
            totalBytes: Number(room.totalBytes || 0), maxBytes: Number(room.maxBytes || 0),
          });
        }

        // Owner, or any room that doesn't require approval → admit immediately.
        if (isOwner || !approvalRequired) {
          const data = await admitSocket(rid, room);
          cb?.(data);
          announceJoin(rid);
          // Owner gets the current waiting list so they can act on earlier knocks.
          if (isOwner) socket.emit('join:pending-list', { pending: getPending(rid) });
          return;
        }

        // Approval required and this is NOT the owner → hold in the waiting room.
        const entry = { id: socket.id, name: userName, accUserId, requestedAt: Date.now() };
        pendingMap(rid).set(socket.id, entry);
        emitToOwners(io, rid, 'join:request', { request: entry });
        cb?.({ ok: true, pending: true, user: { id: socket.id, name: userName, role } });
      } catch (e) {
        console.error('auth', e);
        cb?.({ ok: false, error: e.message });
      }
    });

    // ─── Owner-only: approve a waiting joiner ───
    socket.on('join:approve', async ({ socketId }) => {
      if (!isOwner || !roomId) return;
      const entry = pendingMap(roomId).get(socketId);
      if (!entry) return;
      pendingMap(roomId).delete(socketId);
      const room = await findRoomById(roomId);
      if (!room || Number(room.expiresAt) <= Date.now()) {
        io.to(socketId).emit('join:rejected', { reason: 'expired' });
        return;
      }
      // Ask the waiting socket to finish joining itself (it has its own closure).
      io.to(socketId).emit('join:approved', {});
      emitToOwners(io, roomId, 'join:pending-list', { pending: getPending(roomId) });
    });

    // ─── Owner-only: reject a waiting joiner ───
    socket.on('join:reject', ({ socketId }) => {
      if (!isOwner || !roomId) return;
      if (pendingMap(roomId).delete(socketId)) {
        io.to(socketId).emit('join:rejected', { reason: 'declined' });
        emitToOwners(io, roomId, 'join:pending-list', { pending: getPending(roomId) });
      }
    });

    // ─── Waiting socket completes its own admission after approval ───
    socket.on('join:finalize', async (_payload, cb) => {
      try {
        if (approved || !roomId) return cb?.({ ok: false });
        const room = await findRoomById(roomId);
        if (!room || Number(room.expiresAt) <= Date.now()) return cb?.({ ok: false, error: 'Expired' });
        // Only proceed if we are genuinely no longer pending (owner approved us).
        if (pendingMap(roomId).has(socket.id)) return cb?.({ ok: false, error: 'Still pending' });
        const data = await admitSocket(roomId, room);
        cb?.(data);
        announceJoin(roomId);
      } catch (e) {
        console.error('join:finalize', e.message);
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on('message:send', async ({ text, attachment }) => {
      if (!roomId || !approved || role === 'admin') return;
      try {
        const msg = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: socket.id, fromName: userName,
          type: 'text',
          text: (text || '').slice(0, 4000),
          attachment: attachment || null,
          timestamp: Date.now(),
        };
        await addMessage(roomId, msg, roomExpiresAt);
        io.to(roomId).emit('message:new', msg);
      } catch (e) { console.error('message:send', e.message); }
    });

    socket.on('clipboard:update', async ({ text }) => {
      if (!roomId || !approved || role === 'admin') return;
      try {
        const safe = (text || '').slice(0, 100_000);
        await setRoomText(roomId, safe);
        socket.to(roomId).emit('clipboard:updated', { text: safe });
      } catch (e) { console.error('clipboard', e.message); }
    });

    socket.on('typing', ({ isTyping }) => {
      if (!roomId || !approved || role === 'admin') return;
      socket.to(roomId).emit('typing', { userId: socket.id, name: userName, isTyping });
    });

    socket.on('call:invite', ({ kind }) => {
      if (!roomId || !approved || role === 'admin') return;
      socket.to(roomId).emit('call:incoming', { from: socket.id, fromName: userName, kind });
    });
    socket.on('call:accept', ({ to }) => { if (approved && role !== 'admin') io.to(to).emit('call:accepted', { from: socket.id }); });
    socket.on('call:reject', ({ to }) => { if (approved && role !== 'admin') io.to(to).emit('call:rejected', { from: socket.id }); });
    socket.on('webrtc:offer', ({ to, sdp }) => { if (approved && role !== 'admin') io.to(to).emit('webrtc:offer', { from: socket.id, sdp }); });
    socket.on('webrtc:answer', ({ to, sdp }) => { if (approved && role !== 'admin') io.to(to).emit('webrtc:answer', { from: socket.id, sdp }); });
    socket.on('webrtc:ice', ({ to, candidate }) => { if (approved && role !== 'admin') io.to(to).emit('webrtc:ice', { from: socket.id, candidate }); });
    socket.on('call:end', ({ to }) => { if (approved && role !== 'admin') io.to(to).emit('call:ended', { from: socket.id }); });

    socket.on('disconnect', () => {
      if (!roomId || role === 'admin') return;
      // Clean up owner + pending tracking.
      ownerSet(roomId).delete(socket.id);
      if (pendingMap(roomId).delete(socket.id)) {
        emitToOwners(io, roomId, 'join:pending-list', { pending: getPending(roomId) });
      }
      // If they were a full member, announce departure.
      const map = roomMembers.get(roomId);
      const left = map?.get(socket.id);
      if (left) {
        map.delete(socket.id);
        socket.to(roomId).emit('member-left', { id: socket.id, name: left?.name || 'Someone' });
        io.to(roomId).emit('members-updated', { members: getMembers(roomId) });
      }
    });
  });
}
