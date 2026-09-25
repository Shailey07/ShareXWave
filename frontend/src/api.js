import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API = axios.create({ baseURL: `${API_BASE}/api` });
let roomToken = null;
let adminToken = null;

/* Account token persists across reloads (optional WhatsApp-style login).
   Anonymous users never touch this — it stays null and nothing changes. */
const ACCOUNT_KEY = 'sxw_account_token';
let accountToken = (typeof localStorage !== 'undefined' && localStorage.getItem(ACCOUNT_KEY)) || null;

export const setRoomToken = (t) => { roomToken = t; };
export const getRoomToken = () => roomToken;
export const setAdminToken = (t) => { adminToken = t; };
export const getAdminToken = () => adminToken;

export const setAccountToken = (t) => {
  accountToken = t || null;
  try {
    if (t) localStorage.setItem(ACCOUNT_KEY, t);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch { /* storage may be unavailable */ }
};
export const getAccountToken = () => accountToken;

API.interceptors.request.use((cfg) => {
  if (roomToken && !cfg.headers['x-room-token']) cfg.headers['x-room-token'] = roomToken;
  if (adminToken && !cfg.headers['x-admin-token']) cfg.headers['x-admin-token'] = adminToken;
  if (accountToken && !cfg.headers['x-account-token']) cfg.headers['x-account-token'] = accountToken;
  return cfg;
});

/* ─── User endpoints ─── */
export const createRoom = (body) => API.post('/rooms', body);
export const createPrivate = (body) => API.post('/private', body);
export const joinRoom = (body) => API.post('/join', body);
export const joinById = (roomId, password) => API.post('/join-by-id', { roomId, password });
export const getRoom = (id) => API.get(`/rooms/${id}`);

export const uploadFile = (roomId, file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post(`/rooms/${roomId}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
  });
};

export const deleteFile = (roomId, fileId) => API.delete(`/rooms/${roomId}/files/${fileId}`);
export const downloadFileUrl = (roomId, fileId) =>
  `${API_BASE}/api/rooms/${roomId}/files/${fileId}?token=${encodeURIComponent(roomToken || '')}`;

/* ─── Admin endpoints ─── */
export const adminLogin = (username, password) => API.post('/admin/login', { username, password });
export const adminListRooms = () => API.get('/admin/rooms');
export const adminGetRoom = (roomId) => API.get(`/admin/rooms/${roomId}`);
export const adminDeleteRoom = (roomId) => API.delete(`/admin/rooms/${roomId}`);

/* ─── Account endpoints (optional login — NO OTP) ─── */
export const signup = (body) => API.post('/auth/signup', body);
export const login = (body) => API.post('/auth/login', body);
export const getMe = () => API.get('/me');
export const getMySessions = () => API.get('/me/sessions');
/* Re-open an owned/joined session without re-entering the password. */
export const openMySession = (roomId) => API.post(`/me/sessions/${roomId}/token`);
/* Owner-only: extend a session before it expires. */
export const extendMySession = (roomId, duration) => API.post(`/me/sessions/${roomId}/extend`, { duration });
export const logoutAccount = () => setAccountToken(null);
