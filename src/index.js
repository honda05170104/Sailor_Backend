import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import methodGuard from './middleware/methodGuard.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import userRoutes from './user/routes/index.js';
import managerRoutes from './manager/routes/index.js';
import { ensureBootstrapManager } from './manager/services/manager.service.js';
import { ensureGlobalConfig } from './manager/services/config.service.js';
import { ensureDefaultVips } from './utils/vip.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const managerPublicDir = path.join(__dirname, 'manager/public');
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localhostOriginPattern = /^https?:\/\/localhost(?::\d+)?$/;
const requestLogFormat =
  '[:date[iso]] :method :url :status :response-time ms - :res[content-length] bytes - :remote-addr';

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        corsOrigins.includes(origin) ||
        localhostOriginPattern.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan(requestLogFormat));
app.use(methodGuard);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function sendManagerPage(file) {
  return (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(managerPublicDir, file));
  };
}

function sendAsset(file, type) {
  return (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type(type);
    res.sendFile(path.join(managerPublicDir, file));
  };
}

app.get('/assets/shared.js', sendAsset('shared/shared.js', 'application/javascript'));
app.get('/assets/shared.css', sendAsset('shared/shared.css', 'text/css'));
app.get('/assets/members.js', sendAsset('members/members.js', 'application/javascript'));
app.get('/assets/members.css', sendAsset('members/members.css', 'text/css'));
app.get('/assets/products.js', sendAsset('products/products.js', 'application/javascript'));
app.get('/assets/products.css', sendAsset('products/products.css', 'text/css'));
app.get('/assets/mice.js', sendAsset('mice/mice.js', 'application/javascript'));
app.get('/assets/mice.css', sendAsset('mice/mice.css', 'text/css'));
app.get('/assets/settings.js', sendAsset('settings/settings.js', 'application/javascript'));
app.get('/assets/settings.css', sendAsset('settings/settings.css', 'text/css'));

app.get(['/manager', '/manager/'], sendManagerPage('login/index.html'));
app.get('/dashboard', (_req, res) => {
  res.redirect('/members');
});
app.get(['/members', '/members/'], sendManagerPage('members/index.html'));
app.get(['/vips', '/vips/'], sendManagerPage('vips/index.html'));
app.get(['/coupons', '/coupons/'], sendManagerPage('coupons/index.html'));
app.get(['/tags', '/tags/'], sendManagerPage('tags/index.html'));
app.get(['/products', '/products/'], sendManagerPage('products/index.html'));
app.get(['/mice', '/mice/'], sendManagerPage('mice/index.html'));
app.get(['/settings', '/settings/'], sendManagerPage('settings/index.html'));
app.get(['/branches', '/branches/'], sendManagerPage('branches/index.html'));
app.get('/dashboad', (_req, res) => {
  res.redirect('/members');
});

app.use(express.static(managerPublicDir, { index: false, redirect: false }));

app.get('/members/:id', (req, res, next) => {
  if (path.extname(req.params.id)) return next();
  return sendManagerPage('member-detail/index.html')(req, res);
});

app.use('/api/v1/user', userRoutes);
app.use('/api/v1/manager', managerRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await ensureBootstrapManager();
    await ensureDefaultVips();
    await ensureGlobalConfig();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
