import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

export async function connectDB() {
  await pool.query('SELECT 1');
  console.log('✅ Supabase PostgreSQL connected');
}

/* ─── Rooms ─── */
export async function findRoomByCode(code) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE code = $1', [code.toUpperCase()]);
  return rows[0];
}

export async function findRoomByGmail(gmail) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE gmail = $1', [gmail.toLowerCase()]);
  return rows[0];
}

export async function findRoomById(roomId) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
  return rows[0];
}

export async function createRoom(data) {
  const { rows } = await pool.query(
    `INSERT INTO rooms (room_id, code, gmail, password_hash, display_name, type, expires_at, max_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.roomId, data.code, data.gmail, data.passwordHash, data.displayName, data.type, data.expiresAt, data.maxBytes]
  );
  return rows[0];
}

export async function getRoomMessages(roomId, limit = 200) {
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp ASC LIMIT $2',
    [roomId, limit]
  );
  return rows.map(r => ({
    id: r.msg_id || r.id,
    from: r.from_id,
    fromName: r.from_name,
    type: r.type,
    text: r.text,
    attachment: r.attachment,
    timestamp: Number(r.timestamp),
  }));
}

export async function getRoomFiles(roomId) {
  const { rows } = await pool.query(
    'SELECT * FROM files WHERE room_id = $1 ORDER BY uploaded_at ASC',
    [roomId]
  );
  return rows.map(r => ({
    id: r.file_id,
    originalName: r.original_name,
    size: Number(r.size),
    mimetype: r.mimetype,
    uploadedAt: new Date(Number(r.uploaded_at)).toISOString(),
  }));
}

export async function addMessage(roomId, msg) {
  await pool.query(
    `INSERT INTO messages (room_id, msg_id, from_id, from_name, type, text, attachment, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [roomId, msg.id, msg.from, msg.fromName, msg.type, msg.text, msg.attachment, msg.timestamp]
  );
}

export async function updateRoomText(roomId, text) {
  await pool.query('UPDATE rooms SET text_content = $1 WHERE room_id = $2', [text, roomId]);
}

export async function addFileToRoom(roomId, file) {
  await pool.query(
    `INSERT INTO files (room_id, file_id, original_name, size, mimetype)
     VALUES ($1, $2, $3, $4, $5)`,
    [roomId, file.id, file.originalName, file.size, file.mimetype]
  );
  await pool.query(
    'UPDATE rooms SET total_bytes = total_bytes + $1 WHERE room_id = $2',
    [file.size, roomId]
  );
}

export async function removeFileFromRoom(roomId, fileId, size) {
  await pool.query('DELETE FROM files WHERE room_id = $1 AND file_id = $2', [roomId, fileId]);
  await pool.query(
    'UPDATE rooms SET total_bytes = GREATEST(0, total_bytes - $1) WHERE room_id = $2',
    [size, roomId]
  );
}

export async function deleteRoom(roomId) {
  await pool.query('DELETE FROM rooms WHERE room_id = $1', [roomId]);
}

export async function getExpiredRooms() {
  const { rows } = await pool.query('SELECT room_id FROM rooms WHERE expires_at <= $1', [Date.now()]);
  return rows.map(r => r.room_id);
}