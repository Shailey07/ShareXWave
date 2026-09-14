import { pool } from './db.js';
import { deleteRoomFiles } from './storage.js';

export function startCleanupLoop(io) {
  setInterval(async () => {
    try {
      const { rows } = await pool.query(
        'SELECT room_id FROM rooms WHERE expires_at <= $1',
        [Date.now()]
      );
      for (const r of rows) {
        console.log(`🗑️  Expiring room ${r.room_id}`);
        await deleteRoomFiles(r.room_id).catch(() => {});
        io?.to(r.room_id).emit('room-expired');
        await pool.query('DELETE FROM rooms WHERE room_id = $1', [r.room_id]);
      }
      if (rows.length) console.log(`✅ Cleaned ${rows.length} expired rooms`);
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }, 30_000);
}