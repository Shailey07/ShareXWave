import { pool } from './db.js';
import { validateToken } from './auth.js';

async function findRoom(roomId) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
  return rows[0];
}

// In-memory member tracking per room
const roomMembers = new Map(); // roomId -> Map<socketId, {id, name, isCreator}>

function getMembers(roomId) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  return [...roomMembers.get(roomId).values()];
}

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    let roomId = null;
    let userName = null;
    let role = 'user';

    socket.on('auth', async ({ roomId: rid, token, displayName }, cb) => {
      try {
        const payload = validateToken(token);
        if (!payload) return cb?.({ ok: false, error: 'Invalid token' });

        const isAdmin = payload.role === 'admin';
        if (!isAdmin && payload.roomId !== rid) return cb?.({ ok: false, error: 'Unauthorized' });

        const room = await findRoom(rid);
        if (!room || Number(room.expires_at) <= Date.now()) return cb?.({ ok: false, error: 'Expired' });

        roomId = rid;
        role = isAdmin ? 'admin' : 'user';
        userName = isAdmin ? 'Winterwolf' : (displayName || 'Guest');

        // Determine if this user is creator — check by name match or first in
        const members = getMembers(rid);
        const isCreator = !isAdmin && (members.length === 0 || members[0]?.isCreator === false && members.find(m => m.isCreator) === undefined);

        socket.join(rid);

        // Track member (only real users)
        if (!isAdmin) {
          const memberInfo = { id: socket.id, name: userName, isCreator: members.length === 0 };
          roomMembers.get(rid).set(socket.id, memberInfo);
        }

        const { rows: messages } = await pool.query(
          'SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp ASC LIMIT 200',
          [rid]
        );
        const { rows: files } = await pool.query(
          'SELECT * FROM files WHERE room_id = $1 ORDER BY uploaded_at ASC',
          [rid]
        );

        cb?.({
          ok: true,
          user: { id: socket.id, name: userName, role },
          messages: messages.map(m => ({
            id: m.msg_id || m.id,
            from: m.from_id,
            fromName: m.from_name,
            type: m.type,
            text: m.text,
            attachment: m.attachment,
            timestamp: Number(m.timestamp),
          })),
          textContent: room.text_content || '',
          files: files.map(f => ({
            id: f.file_id,
            originalName: f.original_name,
            size: Number(f.size),
            mimetype: f.mimetype,
            uploadedAt: Number(f.uploaded_at),
          })),
          totalBytes: Number(room.total_bytes),
          maxBytes: Number(room.max_bytes),
        });

        if (!isAdmin) {
          socket.to(rid).emit('member-joined', { id: socket.id, name: userName });
          io.to(rid).emit('members-updated', { members: getMembers(rid) });
        }
      } catch (e) {
        console.error('auth', e);
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on('message:send', async ({ text, attachment }) => {
      if (!roomId || role === 'admin') return;
      try {
        const msg = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: socket.id, fromName: userName,
          type: 'text',
          text: (text || '').slice(0, 4000),
          attachment: attachment || null,
          timestamp: Date.now(),
        };
        await pool.query(
          `INSERT INTO messages (room_id, msg_id, from_id, from_name, type, text, attachment, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [roomId, msg.id, msg.from, msg.fromName, msg.type, msg.text, msg.attachment, msg.timestamp]
        );
        io.to(roomId).emit('message:new', msg);
      } catch (e) { console.error('message:send', e.message); }
    });

    socket.on('clipboard:update', async ({ text }) => {
      if (!roomId || role === 'admin') return;
      try {
        const safe = (text || '').slice(0, 100_000);
        await pool.query('UPDATE rooms SET text_content = $1 WHERE room_id = $2', [safe, roomId]);
        socket.to(roomId).emit('clipboard:updated', { text: safe });
      } catch (e) { console.error('clipboard', e.message); }
    });

    socket.on('typing', ({ isTyping }) => {
      if (!roomId || role === 'admin') return;
      socket.to(roomId).emit('typing', { userId: socket.id, name: userName, isTyping });
    });

    socket.on('call:invite', ({ kind }) => {
      if (!roomId || role === 'admin') return;
      socket.to(roomId).emit('call:incoming', { from: socket.id, fromName: userName, kind });
    });
    socket.on('call:accept', ({ to }) => { if (role !== 'admin') io.to(to).emit('call:accepted', { from: socket.id }); });
    socket.on('call:reject', ({ to }) => { if (role !== 'admin') io.to(to).emit('call:rejected', { from: socket.id }); });
    socket.on('webrtc:offer', ({ to, sdp }) => { if (role !== 'admin') io.to(to).emit('webrtc:offer', { from: socket.id, sdp }); });
    socket.on('webrtc:answer', ({ to, sdp }) => { if (role !== 'admin') io.to(to).emit('webrtc:answer', { from: socket.id, sdp }); });
    socket.on('webrtc:ice', ({ to, candidate }) => { if (role !== 'admin') io.to(to).emit('webrtc:ice', { from: socket.id, candidate }); });
    socket.on('call:end', ({ to }) => { if (role !== 'admin') io.to(to).emit('call:ended', { from: socket.id }); });

    socket.on('disconnect', () => {
      if (roomId && role !== 'admin') {
        const map = roomMembers.get(roomId);
        const left = map?.get(socket.id);
        if (map) map.delete(socket.id);
        socket.to(roomId).emit('member-left', { id: socket.id, name: left?.name || 'Someone' });
        io.to(roomId).emit('members-updated', { members: getMembers(roomId) });
      }
    });
  });
}