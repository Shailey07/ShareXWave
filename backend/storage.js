import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.ensureDirSync(UPLOADS_DIR);

/* 50 MB session total (admin aur user same) */
export const MAX_BYTES = 50 * 1024 * 1024;

export function getRoomFolder(roomId) {
  const folder = path.join(UPLOADS_DIR, roomId);
  fs.ensureDirSync(folder);
  return folder;
}

export function sanitizeName(name) {
  return path.basename(name || 'file').replace(/[^\w.\-() ]/g, '_').slice(0, 200);
}

export async function saveFile(roomId, file, maxAllowedBytes) {
  if (file.size > maxAllowedBytes) throw new Error('FILE_TOO_LARGE');
  const safeName = sanitizeName(file.originalname);
  const uniqueName = `${Date.now()}-${safeName}`;
  const dest = path.join(getRoomFolder(roomId), uniqueName);
  await fs.move(file.path, dest, { overwrite: true });
  return {
    id: uniqueName,
    originalName: safeName,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date(),
  };
}

export async function deleteFile(roomId, fileId) {
  const p = path.join(getRoomFolder(roomId), fileId);
  if (await fs.pathExists(p)) { await fs.remove(p); return true; }
  return false;
}

export async function deleteRoomFiles(roomId) {
  const folder = path.join(UPLOADS_DIR, roomId);
  if (await fs.pathExists(folder)) await fs.remove(folder);
}