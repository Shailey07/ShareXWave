import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';

import { pool } from './db.js';
import {
  hashPassword, verifyPassword, issueToken, issueAdminToken,
  validateToken, checkRateLimit, validateAdminCredentials, ADMIN_USERNAME,
} from './auth.js';
import { saveFile, deleteFile, deleteRoomFiles, MAX_BYTES } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'uploads', 'temp');
fs.ensureDirSync(TEMP_DIR);
const upload = multer({ dest: TEMP_DIR, limits: { fileSize: MAX_BYTES } });

const router = express.Router();
const genCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const genPassword = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', 8);

/* ─── Auth middleware ─── */
const auth = (req, res, next) => {
  const token = req.headers['x-room-token'];
  const payload = validateToken(token);
  if (!payload || (payload.role !== 'user' && payload.role !== 'admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.roomId = payload.roomId;
  req.role = payload.role;
  next();
};

const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const payload = validateToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'Admin unauthorized' });
  }
  req.admin = payload;
  next();
};

/* ─── DB helpers ─── */
async function findRoomByCode(code) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE code = $1', [code]);
  return rows[0];
}
async function findRoomByGmail(gmail) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE gmail = $1', [gmail]);
  return rows[0];
}
async function findRoomById(roomId) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
  return rows[0];
}

async function shapeRoom(room) {
  const { rows: messages } = await pool.query(
    'SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp ASC LIMIT 200',
    [room.room_id]
  );
  const { rows: files } = await pool.query(
    'SELECT * FROM files WHERE room_id = $1 ORDER BY uploaded_at ASC',
    [room.room_id]
  );
  return {
    roomId: room.room_id,
    code: room.code,
    displayName: room.display_name,
    type: room.type,
    expiresAt: Number(room.expires_at),
    textContent: room.text_content || '',
    messages: messages.map(m => ({
      id: m.msg_id || m.id,
      from: m.from_id,
      fromName: m.from_name,
      type: m.type,
      text: m.text,
      attachment: m.attachment,
      timestamp: Number(m.timestamp),
    })),
    files: files.map(f => ({
      id: f.file_id,
      originalName: f.original_name,
      size: Number(f.size),
      mimetype: f.mimetype,
      uploadedAt: Number(f.uploaded_at),
    })),
    totalBytes: Number(room.total_bytes),
    maxBytes: Number(room.max_bytes),
  };
}

/* ═══════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════ */

router.post('/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(ip, 5, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });

  const { username, password } = req.body || {};
  if (!validateAdminCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = issueAdminToken(24 * 3600_000);
  res.json({ token, username: ADMIN_USERNAME });
});

router.get('/admin/rooms', adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT room_id, code, gmail, display_name, type, created_at, expires_at, total_bytes, plain_password FROM rooms WHERE expires_at > $1 ORDER BY created_at DESC',
      [Date.now()]
    );
    const list = [];
    for (const r of rows) {
      const { rows: msgs } = await pool.query(
        'SELECT from_name, text, timestamp FROM messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT 1',
        [r.room_id]
      );
      const { rows: msgCount } = await pool.query(
        'SELECT COUNT(*)::int AS c FROM messages WHERE room_id = $1',
        [r.room_id]
      );
      const { rows: fileCount } = await pool.query(
        'SELECT COUNT(*)::int AS c FROM files WHERE room_id = $1',
        [r.room_id]
      );
      list.push({
        roomId: r.room_id,
        code: r.code,
        gmail: r.gmail,
        displayName: r.display_name,
        type: r.type,
        createdAt: Number(r.created_at),
        expiresAt: Number(r.expires_at),
        messageCount: msgCount[0].c,
        fileCount: fileCount[0].c,
        totalBytes: Number(r.total_bytes),
        lastMessage: msgs[0] || null,
        plainPassword: r.plain_password || null,
      });
    }
    res.json({ rooms: list, count: list.length });
  } catch (e) {
    console.error('admin/rooms', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/rooms/:id', adminAuth, async (req, res) => {
  try {
    const room = await findRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(await shapeRoom(room));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/admin/rooms/:id', adminAuth, async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await findRoomById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    await deleteRoomFiles(roomId).catch(e => console.error('disk cleanup:', e.message));
    await pool.query('DELETE FROM messages WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM files WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM rooms WHERE room_id = $1', [roomId]);

    req.app.get('io')?.to(roomId).emit('room-expired');
    console.log(`🗑️  Admin deleted room ${roomId}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin delete room', e);
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════
   USER
   ═══════════════════════════════════════════ */

/* Create Quick Room */
router.post('/rooms', async (req, res) => {
  try {
    const { displayName, password: userPw, ttlMs, creatorName } = req.body || {};
    let code;
    do { code = genCode(); } while (await findRoomByCode(code));

    const password = userPw?.trim() || genPassword();
    const ttl = Math.min(Math.max(Number(ttlMs) || 3600_000, 60_000), 3600_000);
    const now = Date.now();
    const roomId = uuid();

    // display_name: room name if given, else creator name
    const roomLabel = (displayName && displayName.trim()) || (creatorName && creatorName.trim()) || null;

    await pool.query(
      `INSERT INTO rooms (room_id, code, password_hash, plain_password, display_name, type, expires_at, max_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [roomId, code, hashPassword(password), password, roomLabel, 'quick', now + ttl, MAX_BYTES]
    );

    const qrPayload = JSON.stringify({ c: code, p: password, r: roomId });
    const qrCode = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M', margin: 1, width: 320,
      color: { dark: '#12102a', light: '#ffffff' },
    });

    res.json({
      roomId,
      code,
      password,
      roomPassword: password,
      displayName: roomLabel,
      qrCode,
      expiresAt: now + ttl,
    });
  } catch (e) {
    console.error('rooms', e);
    res.status(500).json({ error: e.message });
  }
});

/* Create Private Room */
router.post('/private', async (req, res) => {
  try {
    const { gmail, password, displayName, creatorName } = req.body || {};
    if (!gmail || !/^\S+@\S+\.\S+$/.test(gmail)) return res.status(400).json({ error: 'Invalid email' });
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password too short' });

    const key = gmail.toLowerCase().trim();
    const existing = await findRoomByGmail(key);
    if (existing && Number(existing.expires_at) > Date.now()) {
      return res.status(409).json({ error: 'ID already active' });
    }

    const now = Date.now();
    const roomId = uuid();
    const roomLabel = (displayName && displayName.trim()) || (creatorName && creatorName.trim()) || key;

    await pool.query(
      `INSERT INTO rooms (room_id, gmail, password_hash, plain_password, display_name, type, expires_at, max_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [roomId, key, hashPassword(password), password, roomLabel, 'private', now + 24 * 3600_000, MAX_BYTES]
    );

    res.json({
      roomId,
      gmail: key,
      roomPassword: password,
      displayName: roomLabel,
      expiresAt: now + 24 * 3600_000,
    });
  } catch (e) {
    console.error('private', e);
    res.status(500).json({ error: e.message });
  }
});

/* Join by code or gmail */
router.post('/join', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(ip, 10, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });

  try {
    const { code, gmail, password } = req.body || {};
    let room;
    if (code)       room = await findRoomByCode(code.toUpperCase());
    else if (gmail) room = await findRoomByGmail(gmail.toLowerCase().trim());
    if (!room) return res.status(404).json({ error: 'Invalid credentials' });
    if (Number(room.expires_at) <= Date.now()) return res.status(410).json({ error: 'Session expired' });
    if (!verifyPassword(password, room.password_hash)) return res.status(401).json({ error: 'Incorrect password' });

    const token = issueToken(room.room_id, Math.min(Number(room.expires_at) - Date.now(), 3600_000));
    res.json({
      ...(await shapeRoom(room)),
      token,
      roomPassword: room.plain_password || password,
    });
  } catch (e) {
    console.error('join', e);
    res.status(500).json({ error: e.message });
  }
});

/* Join by roomId (QR deep-link) */
router.post('/join-by-id', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(ip, 10, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts' });

  try {
    const { roomId, password } = req.body || {};
    const room = await findRoomById(roomId);
    if (!room) return res.status(404).json({ error: 'Invalid room' });
    if (Number(room.expires_at) <= Date.now()) return res.status(410).json({ error: 'Session expired' });
    if (!verifyPassword(password, room.password_hash)) return res.status(401).json({ error: 'Incorrect password' });

    const token = issueToken(room.room_id, Math.min(Number(room.expires_at) - Date.now(), 3600_000));
    res.json({
      ...(await shapeRoom(room)),
      token,
      roomPassword: room.plain_password || password,
    });
  } catch (e) {
    console.error('join-by-id', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/rooms/:id', auth, async (req, res) => {
  const room = await findRoomById(req.roomId);
  if (!room || Number(room.expires_at) <= Date.now()) return res.status(410).json({ error: 'Expired' });
  res.json({ ...(await shapeRoom(room)), roomPassword: room.plain_password });
});

/* Upload */
router.post('/rooms/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const room = await findRoomById(req.roomId);
    if (!room || Number(room.expires_at) <= Date.now()) return res.status(410).json({ error: 'Expired' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const FILE_LIMIT = 50 * 1024 * 1024;
    if (req.file.size > FILE_LIMIT) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(413).json({ error: 'File exceeds 50MB limit' });
    }

    const remaining = Number(room.max_bytes) - Number(room.total_bytes);
    if (req.file.size > remaining) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(413).json({ error: 'Storage limit exceeded', remaining, used: Number(room.total_bytes) });
    }

    const meta = await saveFile(room.room_id, req.file, remaining);

    await pool.query(
      `INSERT INTO files (room_id, file_id, original_name, size, mimetype)
       VALUES ($1, $2, $3, $4, $5)`,
      [room.room_id, meta.id, meta.originalName, meta.size, meta.mimetype]
    );
    await pool.query('UPDATE rooms SET total_bytes = total_bytes + $1 WHERE room_id = $2', [meta.size, room.room_id]);

    const newTotal = Number(room.total_bytes) + req.file.size;
    req.app.get('io')?.to(room.room_id).emit('file-added', {
      file: { id: meta.id, originalName: meta.originalName, size: meta.size, mimetype: meta.mimetype },
      totalBytes: newTotal,
    });

    res.json({
      file: { id: meta.id, originalName: meta.originalName, size: meta.size, mimetype: meta.mimetype },
      totalBytes: newTotal,
      maxBytes: Number(room.max_bytes),
    });
  } catch (e) {
    console.error('upload', e);
    res.status(500).json({ error: e.message });
  }
});

/* Download */
router.get('/rooms/:id/files/:fileId', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-room-token'];
    const payload = validateToken(token);
    if (!payload || (payload.roomId !== req.params.id && payload.role !== 'admin')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM files WHERE room_id = $1 AND file_id = $2',
      [req.params.id, req.params.fileId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const file = rows[0];
    const filePath = path.join(__dirname, 'uploads', req.params.id, file.file_id);
    res.download(filePath, file.original_name);
  } catch (e) {
    console.error('download', e);
    res.status(500).json({ error: e.message });
  }
});

/* Delete file */
router.delete('/rooms/:id/files/:fileId', auth, async (req, res) => {
  try {
    const room = await findRoomById(req.roomId);
    if (!room) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      'SELECT * FROM files WHERE room_id = $1 AND file_id = $2',
      [req.roomId, req.params.fileId]
    );
    if (!rows[0]) return res.json({ ok: true });

    const file = rows[0];
    await deleteFile(req.roomId, file.file_id);
    await pool.query('DELETE FROM files WHERE room_id = $1 AND file_id = $2', [req.roomId, file.file_id]);
    await pool.query(
      'UPDATE rooms SET total_bytes = GREATEST(0, total_bytes - $1) WHERE room_id = $2',
      [Number(file.size), req.roomId]
    );

    const newTotal = Math.max(0, Number(room.total_bytes) - Number(file.size));
    req.app.get('io')?.to(req.roomId).emit('file-deleted', { fileId: file.file_id, totalBytes: newTotal });
    res.json({ ok: true });
  } catch (e) {
    console.error('delete', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;