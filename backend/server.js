import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import { connectDB } from './db.js';
import routes from './routes.js';
import { setupSocketHandlers } from './sockets.js';
import { startCleanupLoop } from './cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

await connectDB();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  },
  maxHttpBufferSize: 5 * 1024 * 1024,
});

app.set('io', io);
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }), routes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const fe = path.join(__dirname, '../frontend/dist');
  app.use(express.static(fe));
  app.get('*', (_, res) => res.sendFile(path.join(fe, 'index.html')));
}

setupSocketHandlers(io);
startCleanupLoop(io);

const PORT = process.env.PORT || 5004;
server.listen(PORT, () => {
  console.log(`🚀 ClipShare backend on :${PORT}`);
});