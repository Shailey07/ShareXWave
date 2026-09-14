import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Winterwolf';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

/* ─── Password helpers ─── */
export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compareSync(pw || '', hash);

/* ─── User token (room access) ─── */
export function issueToken(roomId, ttlMs = 3600_000) {
  return jwt.sign({ roomId, role: 'user' }, SECRET, { expiresIn: Math.floor(ttlMs / 1000) });
}

/* ─── Admin token ─── */
export function issueAdminToken(ttlMs = 24 * 3600_000) {
  return jwt.sign({ role: 'admin', username: ADMIN_USERNAME }, SECRET, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
}

/* ─── Verify any token ─── */
export function validateToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

/* ─── Validate admin login ─── */
export function validateAdminCredentials(username, password) {
  if (!username || !password) return false;
  if (username !== ADMIN_USERNAME) return false;
  if (!ADMIN_PASSWORD_HASH) return false;
  return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
}

export { ADMIN_USERNAME };

/* ─── Rate limiter ─── */
const attempts = new Map();
export function checkRateLimit(ip, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  a.count++;
  if (a.count > max) return { ok: false, retryAfter: Math.ceil((a.resetAt - now) / 1000) };
  return { ok: true };
}