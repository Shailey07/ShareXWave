import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';

import {
  findRoomByCode, findRoomByGmail, findRoomById, insertRoom, shapeRoom,
  addFile, getFileRecord, removeFile, listRoomsForAdmin, deleteRoomCascade,
  findUserByGmail, findUserById, insertUser, addRoomMember, getUserSessions, extendRoom,
} from './db.js';
import {
  hashPassword, verifyPassword, issueToken, issueAdminToken,
  validateToken, checkRateLimit, validateAdminCredentials, ADMIN_USERNAME,
  issueAccountToken, validateAccountToken,
} from './auth.js';
import { saveFile, deleteFile, deleteRoomFiles, MAX_BYTES } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'uploads', 'temp');
fs.ensureDirSync(TEMP_DIR);
const upload = multer({ dest: TEMP_DIR, limits: { fileSize: MAX_BYTES } });

const router = express.Router();
const genCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const genPassword = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', 8);

/* Room password length limit (enforced server-side) */
const PW_MIN = 4;
const PW_MAX = 32;

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

/* ─── Account auth (optional login) ─── */
const accountAuth = (req, res, next) => {
  const payload = validateAccountToken(req.headers['x-account-token']);
  if (!payload) return res.status(401).json({ error: 'Login required' });
  req.userId = payload.userId;
  req.account = payload;
  next();
};

/* Read an account token if present, but never fail — lets create/join stay
   fully anonymous while linking ownership when the user happens to be logged in. */
const optionalAccount = (req) => validateAccountToken(req.headers['x-account-token']);

const GMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════════════════════════
   ACCOUNTS — optional signup / login (NO OTP)
   ═══════════════════════════════════════════ */

router.post('/auth/signup', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(`signup:${ip}`, 8, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });
  try {
    const name = String(req.body?.name || '').trim().slice(0, 40);
    const gmail = String(req.body?.gmail || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword ?? req.body?.confirm ?? '');

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!GMAIL_RE.test(gmail)) return res.status(400).json({ error: 'Valid email required' });
    if (password.length < PW_MIN || password.length > PW_MAX) {
      return res.status(400).json({ error: `Password must be ${PW_MIN}–${PW_MAX} characters` });
    }
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    if (await findUserByGmail(gmail)) {
      return res.status(409).json({ error: 'Account already exists — please log in' });
    }

    const user = await insertUser({ userId: uuid(), name, gmail, passwordHash: hashPassword(password) });
    const token = issueAccountToken(user);
    res.json({ token, user });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ error: 'Account already exists — please log in' });
    console.error('POST /auth/signup', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });
  try {
    const gmail = String(req.body?.gmail || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    const user = await findUserByGmail(gmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    const shaped = { userId: user.userId, name: user.name, gmail: user.gmail };
    const token = issueAccountToken(shaped);
    res.json({ token, user: shaped });
  } catch (e) {
    console.error('POST /auth/login', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', accountAuth, (req, res) => {
  res.json({ user: { userId: req.account.userId, name: req.account.name, gmail: req.account.gmail } });
});

/* Still-valid sessions this account owns or has joined. */
router.get('/me/sessions', accountAuth, async (req, res) => {
  try {
    const sessions = await getUserSessions(req.userId);
    res.json({ sessions });
  } catch (e) {
    console.error('GET /me/sessions', e);
    res.status(500).json({ error: e.message });
  }
});

/* Re-open an owned/joined session WITHOUT re-entering the password. */
router.post('/me/sessions/:id/token', accountAuth, async (req, res) => {
  try {
    const room = await findRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Session not found' });
    if (Number(room.expiresAt) <= Date.now()) return res.status(410).json({ error: 'Session expired' });

    const isOwner = room.ownerUserId === req.userId;
    const isMember = Array.isArray(room.memberUserIds) && room.memberUserIds.includes(req.userId);
    if (!isOwner && !isMember) return res.status(403).json({ error: 'Not your session' });

    const token = issueToken(room.roomId, Math.max(60_000, Number(room.expiresAt) - Date.now()));
    res.json({
      ...(await shapeRoom(room)),
      token,
      roomPassword: room.plainPassword || null,
      isOwner,
    });
  } catch (e) {
    console.error('POST /me/sessions/:id/token', e);
    res.status(500).json({ error: e.message });
  }
});

/* Owner-only: extend a session before it expires (up to a 24h window from now). */
router.post('/me/sessions/:id/extend', accountAuth, async (req, res) => {
  try {
    const room = await findRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Session not found' });
    if (room.ownerUserId !== req.userId) return res.status(403).json({ error: 'Only the owner can extend' });
    if (Number(room.expiresAt) <= Date.now()) return res.status(410).json({ error: 'Session already expired' });

    const allowed = { '1h': 3600_000, '6h': 6 * 3600_000, '24h': 24 * 3600_000 };
    const addMs = allowed[String(req.body?.duration || '24h')] || allowed['24h'];
    // Extend from the CURRENT expiry, capped at 24h ahead of now.
    const capped = Date.now() + 24 * 3600_000;
    const newExpiresAt = Math.min(Number(room.expiresAt) + addMs, capped);

    await extendRoom(room.roomId, newExpiresAt);
    req.app.get('io')?.to(room.roomId).emit('session:extended', { expiresAt: newExpiresAt });
    res.json({ ok: true, expiresAt: newExpiresAt });
  } catch (e) {
    console.error('POST /me/sessions/:id/extend', e);
    res.status(500).json({ error: e.message });
  }
});
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
    const list = await listRoomsForAdmin();
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
    await deleteRoomCascade(roomId);

    req.app.get('io')?.to(roomId).emit('room-expired');
    console.log(`🗑️  Admin deleted room ${roomId}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin delete room', e);
    res.status(500).json({ error: e.message });
  }
});
/* ═══════════════════════════════════════════
   ROOMS — create
   ═══════════════════════════════════════════ */

/* Quick room: 6-char code, ≤ 1h TTL */
router.post('/rooms', async (req, res) => {
  try {
    const { displayName, ttlMs } = req.body || {};
    let password = String((req.body?.password ?? '')).trim();

    if (password) {
      if (password.length < PW_MIN || password.length > PW_MAX) {
        return res.status(400).json({ error: `Password must be ${PW_MIN}–${PW_MAX} characters` });
      }
    } else {
      password = genPassword(); // blank → auto-generate
    }

    const ttl = Math.min(Math.max(Number(ttlMs) || 3600_000, 60_000), 3600_000); // 1min–1h
    const now = Date.now();
    const expiresAt = now + ttl;

    let code;
    do { code = genCode(); } while (await findRoomByCode(code));

    const roomId = uuid();
    const roomLabel = String(displayName || '').trim();

    // If the creator is logged in, link ownership so it shows in "My Sessions"
    // and enable host-approval by default. Anonymous rooms are unchanged.
    const acc = optionalAccount(req);
    const ownerUserId = acc?.userId || null;
    const approvalRequired = ownerUserId ? (req.body?.approvalRequired !== false) : false;

    await insertRoom({
      roomId, code, gmail: null,
      passwordHash: hashPassword(password), plainPassword: password,
      displayName: roomLabel, type: 'quick',
      createdAt: now, expiresAt,
      textContent: '', totalBytes: 0, maxBytes: MAX_BYTES,
      ownerUserId, ownerName: acc?.name || null,
      memberUserIds: ownerUserId ? [ownerUserId] : [],
      approvalRequired,
    });

    const qrCode = await QRCode.toDataURL(JSON.stringify({ c: code, p: password, r: roomId }));

    res.json({
      roomId, code, password, roomPassword: password,
      displayName: roomLabel || null, qrCode, expiresAt,
      ownerUserId, approvalRequired,
    });
  } catch (e) {
    console.error('POST /rooms', e);
    res.status(500).json({ error: e.message });
  }
});
/* Private room: Gmail as unique ID, 24h TTL */
router.post('/private', async (req, res) => {
  try {
    const gmail = String(req.body?.gmail || '').toLowerCase().trim();
    const password = String(req.body?.password || '').trim();
    const displayName = String(req.body?.displayName || '').trim();

    if (!gmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
      return res.status(400).json({ error: 'Valid Gmail required' });
    }
    if (password.length < PW_MIN || password.length > PW_MAX) {
      return res.status(400).json({ error: `Password must be ${PW_MIN}–${PW_MAX} characters` });
    }

    const existing = await findRoomByGmail(gmail);
    if (existing) {
      if (Number(existing.expiresAt) > Date.now()) {
        return res.status(409).json({ error: 'This Gmail ID is already active — join it instead' });
      }
      // Expired but not yet TTL-purged → clear it so re-creation is clean
      await deleteRoomFiles(existing.roomId).catch(() => {});
      await deleteRoomCascade(existing.roomId);
    }

    const now = Date.now();
    const expiresAt = now + 24 * 3600_000;
    const roomId = uuid();

    const acc = optionalAccount(req);
    const ownerUserId = acc?.userId || null;
    const approvalRequired = ownerUserId ? (req.body?.approvalRequired !== false) : false;

    await insertRoom({
      roomId, code: null, gmail,
      passwordHash: hashPassword(password), plainPassword: password,
      displayName, type: 'private',
      createdAt: now, expiresAt,
      textContent: '', totalBytes: 0, maxBytes: MAX_BYTES,
      ownerUserId, ownerName: acc?.name || null,
      memberUserIds: ownerUserId ? [ownerUserId] : [],
      approvalRequired,
    });

    res.json({ roomId, gmail, displayName: displayName || null, expiresAt, ownerUserId, approvalRequired });
  } catch (e) {
    console.error('POST /private', e);
    res.status(500).json({ error: e.message });
  }
});
/* ═══════════════════════════════════════════
   ROOMS — join
   ═══════════════════════════════════════════ */

router.post('/join', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(`join:${ip}`, 10, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });
  try {
    const { code, gmail, password } = req.body || {};
    const room = code ? await findRoomByCode(code)
               : gmail ? await findRoomByGmail(gmail)
               : null;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (Number(room.expiresAt) <= Date.now()) return res.status(410).json({ error: 'Session expired' });
    if (!verifyPassword(password, room.passwordHash)) return res.status(401).json({ error: 'Incorrect password' });

    // If joining while logged in, remember this room in the account's list.
    const acc = optionalAccount(req);
    if (acc?.userId) await addRoomMember(room.roomId, acc.userId).catch(() => {});

    const token = issueToken(room.roomId, Math.max(60_000, Number(room.expiresAt) - Date.now()));
    res.json({ ...(await shapeRoom(room)), token, roomPassword: room.plainPassword || password });
  } catch (e) {
    console.error('POST /join', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/join-by-id', async (req, res) => {
  const ip = req.ip || 'unknown';
  const rl = checkRateLimit(`join:${ip}`, 10, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts', retryAfter: rl.retryAfter });
  try {
    const { roomId, password } = req.body || {};
    const room = await findRoomById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (Number(room.expiresAt) <= Date.now()) return res.status(410).json({ error: 'Session expired' });
    if (!verifyPassword(password, room.passwordHash)) return res.status(401).json({ error: 'Incorrect password' });

    const acc = optionalAccount(req);
    if (acc?.userId) await addRoomMember(room.roomId, acc.userId).catch(() => {});

    const token = issueToken(room.roomId, Math.max(60_000, Number(room.expiresAt) - Date.now()));
    res.json({ ...(await shapeRoom(room)), token, roomPassword: room.plainPassword || password });
  } catch (e) {
    console.error('POST /join-by-id', e);
    res.status(500).json({ error: e.message });
  }
});
/* ═══════════════════════════════════════════
   ROOMS — detail + files
   ═══════════════════════════════════════════ */

router.get('/rooms/:id', auth, async (req, res) => {
  try {
    const room = await findRoomById(req.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (Number(room.expiresAt) <= Date.now()) return res.status(410).json({ error: 'Session expired' });
    res.json({ ...(await shapeRoom(room)), roomPassword: room.plainPassword });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rooms/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const room = await findRoomById(req.roomId);
    if (!room || Number(room.expiresAt) <= Date.now()) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(room ? 410 : 404).json({ error: room ? 'Session expired' : 'Room not found' });
    }

    const remaining = Number(room.maxBytes) - Number(room.totalBytes);
    if (req.file.size > remaining) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(413).json({ error: 'Storage limit reached' });
    }

    const saved = await saveFile(room.roomId, req.file, remaining);
    await addFile(room.roomId, saved, Number(room.expiresAt));

    const file = {
      id: saved.id, originalName: saved.originalName,
      size: Number(saved.size), mimetype: saved.mimetype, uploadedAt: Date.now(),
    };
    const totalBytes = Number(room.totalBytes) + Number(saved.size);

    req.app.get('io')?.to(room.roomId).emit('file-added', { file, totalBytes });
    res.json({ file, totalBytes });
  } catch (e) {
    if (req.file?.path) await fs.remove(req.file.path).catch(() => {});
    if (e.message === 'FILE_TOO_LARGE') return res.status(413).json({ error: 'File too large' });
    console.error('upload', e);
    res.status(500).json({ error: e.message });
  }
});
/* Download (token via query string or header — admin token also allowed) */
router.get('/rooms/:id/files/:fileId', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-room-token'];
    const payload = validateToken(token);
    const ok = payload && (payload.role === 'admin' || payload.roomId === req.params.id);
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });

    const file = await getFileRecord(req.params.id, req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const abs = path.join(__dirname, 'uploads', req.params.id, file.fileId);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File missing' });
    res.download(abs, file.originalName);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/rooms/:id/files/:fileId', auth, async (req, res) => {
  try {
    const file = await getFileRecord(req.roomId, req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    await deleteFile(req.roomId, file.fileId).catch(() => {});
    await removeFile(req.roomId, file.fileId, Number(file.size));

    const room = await findRoomById(req.roomId);
    const totalBytes = Number(room?.totalBytes || 0);

    req.app.get('io')?.to(req.roomId).emit('file-deleted', { fileId: file.fileId, totalBytes });
    res.json({ ok: true, totalBytes });
  } catch (e) {
    console.error('delete file', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
