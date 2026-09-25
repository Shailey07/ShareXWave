import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) console.warn('⚠️  MONGODB_URI is not set — add it to your environment (.env)');

const client = new MongoClient(uri, { maxPoolSize: 10 });
let db = null;

const rooms    = () => db.collection('rooms');
const messages = () => db.collection('messages');
const files    = () => db.collection('files');
const users    = () => db.collection('users');

export function getDB() {
  if (!db) throw new Error('DB not connected — call connectDB() first');
  return db;
}

export async function connectDB() {
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'sharexwave');

  // Lookup indexes
  await rooms().createIndex({ roomId: 1 }, { unique: true });
  await rooms().createIndex({ code: 1 },  { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
  await rooms().createIndex({ gmail: 1 }, { partialFilterExpression: { gmail: { $type: 'string' } } });
  await messages().createIndex({ roomId: 1, timestamp: 1 });
  await files().createIndex({ roomId: 1, fileId: 1 });

  // Accounts (optional login). These are persistent — NOT ephemeral, no TTL.
  await users().createIndex({ gmail: 1 }, { unique: true });
  // Owner/member lookups for a logged-in user's "my sessions" list.
  await rooms().createIndex({ ownerUserId: 1 }, { partialFilterExpression: { ownerUserId: { $type: 'string' } } });
  await rooms().createIndex({ memberUserIds: 1 });

  // TTL backstops: MongoDB auto-purges each document once expireAt passes,
  // so id/password/chat/files self-destruct after the room's lifetime.
  await rooms().createIndex({ expireAt: 1 },    { expireAfterSeconds: 0 });
  await messages().createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await files().createIndex({ expireAt: 1 },    { expireAfterSeconds: 0 });

  console.log('✅ MongoDB connected');
}

/* ─── Shapers (keep the exact API shape the frontend already expects) ─── */
const shapeMessage = (m) => ({
  id: m.msgId, from: m.fromId, fromName: m.fromName,
  type: m.type, text: m.text, attachment: m.attachment ?? null, timestamp: Number(m.timestamp),
});
const shapeFile = (f) => ({
  id: f.fileId, originalName: f.originalName,
  size: Number(f.size), mimetype: f.mimetype, uploadedAt: Number(f.uploadedAt),
});

/* ─── Rooms ─── */
export async function findRoomByCode(code) {
  if (!code) return null;
  return rooms().findOne({ code: code.toUpperCase() });
}
export async function findRoomByGmail(gmail) {
  if (!gmail) return null;
  return rooms().findOne({ gmail: gmail.toLowerCase().trim() });
}
export async function findRoomById(roomId) {
  if (!roomId) return null;
  return rooms().findOne({ roomId });
}

export async function insertRoom(room) {
  const doc = { ...room, expireAt: new Date(Number(room.expiresAt)) };
  await rooms().insertOne(doc);
  return doc;
}

export async function setRoomText(roomId, text) {
  await rooms().updateOne({ roomId }, { $set: { textContent: text } });
}

export async function incRoomBytes(roomId, delta) {
  await rooms().updateOne({ roomId }, { $inc: { totalBytes: Number(delta) } });
}
export async function decRoomBytes(roomId, delta) {
  await rooms().updateOne({ roomId }, [
    { $set: { totalBytes: { $max: [0, { $subtract: ['$totalBytes', Number(delta)] }] } } },
  ]);
}

/* ─── Messages ─── */
export async function getMessages(roomId, limit = 200) {
  const docs = await messages().find({ roomId }).sort({ timestamp: 1 }).limit(limit).toArray();
  return docs.map(shapeMessage);
}
export async function addMessage(roomId, msg, expiresAtMs) {
  const doc = {
    roomId, msgId: msg.id, fromId: msg.from, fromName: msg.fromName,
    type: msg.type, text: msg.text, attachment: msg.attachment ?? null, timestamp: msg.timestamp,
  };
  if (expiresAtMs) doc.expireAt = new Date(Number(expiresAtMs));
  await messages().insertOne(doc);
}

/* ─── Files ─── */
export async function getFiles(roomId) {
  const docs = await files().find({ roomId }).sort({ uploadedAt: 1 }).toArray();
  return docs.map(shapeFile);
}
export async function getFileRecord(roomId, fileId) {
  return files().findOne({ roomId, fileId });
}
export async function addFile(roomId, file, expiresAtMs) {
  const doc = {
    roomId, fileId: file.id, originalName: file.originalName,
    size: Number(file.size), mimetype: file.mimetype, uploadedAt: Date.now(),
  };
  if (expiresAtMs) doc.expireAt = new Date(Number(expiresAtMs));
  await files().insertOne(doc);
  await incRoomBytes(roomId, Number(file.size));
}
export async function removeFile(roomId, fileId, size) {
  await files().deleteOne({ roomId, fileId });
  await decRoomBytes(roomId, Number(size));
}

/* ─── Full room shape (join / get / admin detail) ─── */
export async function shapeRoom(room) {
  const [msgs, fls] = await Promise.all([getMessages(room.roomId), getFiles(room.roomId)]);
  return {
    roomId: room.roomId,
    code: room.code || null,
    displayName: room.displayName || null,
    type: room.type,
    expiresAt: Number(room.expiresAt),
    textContent: room.textContent || '',
    messages: msgs,
    files: fls,
    totalBytes: Number(room.totalBytes || 0),
    maxBytes: Number(room.maxBytes || 0),
    // Account/ownership metadata (null for anonymous rooms)
    ownerUserId: room.ownerUserId || null,
    ownerName: room.ownerName || null,
    approvalRequired: !!room.approvalRequired,
  };
}

/* ─── Admin ─── */
export async function listRoomsForAdmin() {
  const docs = await rooms().find({ expiresAt: { $gt: Date.now() } }).sort({ createdAt: -1 }).toArray();
  const list = [];
  for (const r of docs) {
    const [last] = await messages().find({ roomId: r.roomId }).sort({ timestamp: -1 }).limit(1).toArray();
    const messageCount = await messages().countDocuments({ roomId: r.roomId });
    const fileCount = await files().countDocuments({ roomId: r.roomId });
    list.push({
      roomId: r.roomId, code: r.code || null, gmail: r.gmail || null,
      displayName: r.displayName || null, type: r.type,
      createdAt: Number(r.createdAt), expiresAt: Number(r.expiresAt),
      messageCount, fileCount, totalBytes: Number(r.totalBytes || 0),
      lastMessage: last ? { from_name: last.fromName, text: last.text, timestamp: Number(last.timestamp) } : null,
      plainPassword: r.plainPassword || null,
    });
  }
  return list;
}

/* ─── Cleanup helpers ─── */
export async function deleteRoomCascade(roomId) {
  await Promise.all([
    messages().deleteMany({ roomId }),
    files().deleteMany({ roomId }),
    rooms().deleteOne({ roomId }),
  ]);
}
export async function getExpiredRoomIds() {
  const docs = await rooms().find({ expiresAt: { $lte: Date.now() } }, { projection: { roomId: 1 } }).toArray();
  return docs.map(d => d.roomId);
}

/* ═══════════════════════════════════════════
   Accounts (optional login) + owned/joined sessions
   ═══════════════════════════════════════════ */

const shapeUser = (u) => (u ? { userId: u.userId, name: u.name, gmail: u.gmail } : null);

export async function findUserByGmail(gmail) {
  if (!gmail) return null;
  return users().findOne({ gmail: gmail.toLowerCase().trim() });
}
export async function findUserById(userId) {
  if (!userId) return null;
  return users().findOne({ userId });
}
export async function insertUser(user) {
  const doc = { ...user, gmail: user.gmail.toLowerCase().trim(), createdAt: Date.now() };
  await users().insertOne(doc);
  return shapeUser(doc);
}
export { shapeUser };

/* Link a logged-in account as a member of a room (created OR joined). */
export async function addRoomMember(roomId, userId) {
  if (!roomId || !userId) return;
  await rooms().updateOne({ roomId }, { $addToSet: { memberUserIds: userId } });
}

/* All still-valid rooms a user owns or has joined — newest first. */
export async function getUserSessions(userId) {
  if (!userId) return [];
  const now = Date.now();
  const docs = await rooms()
    .find({ expiresAt: { $gt: now }, $or: [{ ownerUserId: userId }, { memberUserIds: userId }] })
    .sort({ createdAt: -1 })
    .toArray();
  const list = [];
  for (const r of docs) {
    const [last] = await messages().find({ roomId: r.roomId }).sort({ timestamp: -1 }).limit(1).toArray();
    const messageCount = await messages().countDocuments({ roomId: r.roomId });
    const fileCount = await files().countDocuments({ roomId: r.roomId });
    list.push({
      roomId: r.roomId,
      code: r.code || null,
      gmail: r.gmail || null,
      displayName: r.displayName || null,
      type: r.type,
      createdAt: Number(r.createdAt),
      expiresAt: Number(r.expiresAt),
      isOwner: r.ownerUserId === userId,
      approvalRequired: !!r.approvalRequired,
      messageCount, fileCount,
      totalBytes: Number(r.totalBytes || 0),
      lastMessage: last ? { fromName: last.fromName, text: last.text, timestamp: Number(last.timestamp) } : null,
    });
  }
  return list;
}

/* Extend a room's lifetime and keep its messages/files alive for the same window. */
export async function extendRoom(roomId, newExpiresAt) {
  const exp = Number(newExpiresAt);
  const asDate = new Date(exp);
  await rooms().updateOne({ roomId }, { $set: { expiresAt: exp, expireAt: asDate } });
  await messages().updateMany({ roomId }, { $set: { expireAt: asDate } });
  await files().updateMany({ roomId }, { $set: { expireAt: asDate } });
}
