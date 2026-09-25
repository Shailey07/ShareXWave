import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { getExpiredRoomIds, deleteRoomCascade, findRoomById } from './db.js';
import { deleteRoomFiles } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');

export function startCleanupLoop(io) {
  setInterval(async () => {
    try {
      // 1) Rooms past their expiry that MongoDB's TTL hasn't purged yet:
      //    delete their files, notify members, and cascade-remove the docs.
      const expired = await getExpiredRoomIds();
      for (const roomId of expired) {
        console.log(`🗑️  Expiring room ${roomId}`);
        await deleteRoomFiles(roomId).catch(() => {});
        io?.to(roomId).emit('room-expired');
        await deleteRoomCascade(roomId);
      }
      if (expired.length) console.log(`✅ Cleaned ${expired.length} expired room(s)`);

      // 2) Orphan sweep: on-disk folders whose room doc is gone (e.g. already
      //    removed by MongoDB's TTL index) still have files — remove them.
      if (await fs.pathExists(UPLOADS_DIR)) {
        const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory() || e.name === 'temp') continue;
          const room = await findRoomById(e.name);
          if (!room) {
            console.log(`🧹 Removing orphaned files for ${e.name}`);
            await deleteRoomFiles(e.name).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }, 30_000);
}
