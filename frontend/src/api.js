import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API = axios.create({ baseURL: `${API_BASE}/api` });
let roomToken = null;
let adminToken = null;

export const setRoomToken = (t) => { roomToken = t; };
export const getRoomToken = () => roomToken;
export const setAdminToken = (t) => { adminToken = t; };
export const getAdminToken = () => adminToken;

API.interceptors.request.use((cfg) => {
  if (roomToken && !cfg.headers['x-room-token']) cfg.headers['x-room-token'] = roomToken;
  if (adminToken && !cfg.headers['x-admin-token']) cfg.headers['x-admin-token'] = adminToken;
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
  `/api/rooms/${roomId}/files/${fileId}?token=${encodeURIComponent(roomToken || '')}`;

/* ─── Admin endpoints ─── */
export const adminLogin = (username, password) => API.post('/admin/login', { username, password });
export const adminListRooms = () => API.get('/admin/rooms');
export const adminGetRoom = (roomId) => API.get(`/admin/rooms/${roomId}`);
export const adminDeleteRoom = (roomId) => API.delete(`/admin/rooms/${roomId}`);
