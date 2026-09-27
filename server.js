/**
 * WA BRIDGE - Entry point
 *
 * Menyatukan:
 *   /api/*  -> controller (logika bisnis)
 *   /*      -> halaman statis dari folder public/
 *
 * Menjalankan:  npm start
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import config from './app/config/index.js';
import { rateLimit, notFound, errorHandler } from './app/middlewares/guard.js';
import UserModel from './app/models/User.js';
import BaileysService from './app/services/baileysService.js';

import authRoutes from './app/routes/auth.routes.js';
import botRoutes from './app/routes/bot.routes.js';
import adminRoutes from './app/routes/admin.routes.js';
import configRoutes from './app/routes/config.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ---------------- Middleware global ---------------- */
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit());

/* ---------------- API ---------------- */
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), live: BaileysService.liveCount() });
});

app.use('/api', notFound);

/* ---------------- Halaman ---------------- */
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));

app.get('/', page('index.html'));
app.get('/login', page('login.html'));
app.get('/register', page('register.html'));
app.get('/dashboard', page('dashboard.html'));
app.get('/admin', page('admin.html'));

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.use(errorHandler);

/* ---------------- Boot ---------------- */
async function bootstrap() {
  await UserModel.ensureAdmin({
    nama: 'Administrator',
    email: config.adminEmail,
    password: config.adminPassword,
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log('');
    console.log(`  ${config.brandName} v1.0.0`);
    console.log(`  siap di  http://localhost:${config.port}`);
    console.log(`  admin  ${config.adminEmail}`);
    if (config.jwtSecret.startsWith('ubah-secret')) {
      console.log('  [!] JWT_SECRET masih default. Ganti di .env sebelum produksi.');
    }
    console.log('');
  });

  // Sambungkan lagi bot yang sebelumnya aktif
  BaileysService.resumeAll().catch((e) => console.error('[boot] resumeAll:', e.message));

  const bye = async (signal) => {
    console.log(`\n[${signal}] mematikan server...`);
    server.close();
    await BaileysService.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => bye('SIGINT'));
  process.on('SIGTERM', () => bye('SIGTERM'));
  process.on('uncaughtException', (e) => console.error('[uncaught]', e));
  process.on('unhandledRejection', (e) => console.error('[unhandled]', e));
}

bootstrap();

export default app;
