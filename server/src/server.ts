import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middlewares/errorHandler';
import jwt from 'jsonwebtoken';
import { readSessionToken } from './middlewares/auth';
import prisma from './prisma';

// Import Routes
import authRoutes from './modules/auth/authRoutes';
import orderRoutes from './modules/orders/orderRoutes';
import courierRoutes from './modules/couriers/courierRoutes';
import wooRoutes from './modules/woocommerce/wooRoutes';
import inventoryRoutes from './modules/inventory/inventoryRoutes';
import purchaseRoutes from './modules/purchases/purchaseRoutes';
import accountingRoutes from './modules/accounting/accountingRoutes';
import crmRoutes from './modules/crm/crmRoutes';
import messageRoutes from './modules/messaging/messageRoutes';
import dashboardRoutes from './modules/dashboard/dashboardRoutes';
import auditRoutes from './modules/audit/auditRoutes';
import storefrontRoutes from './modules/storefront/storefrontRoutes';
import mediaRoutes from './modules/media/mediaRoutes';
import builderRoutes, { publicBuilderPage, publicLandingDesign } from './modules/builder/routes';
import { submitBuilderForm } from './modules/builder/formService';
import { countdownRuntime } from './modules/builder/countdownRuntime';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: config.clientUrls,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token = readSessionToken({ headers: socket.handshake.headers as any });
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { id: string; sessionVersion: number; kind?: string; exp?: number };
    if (decoded.kind === 'customer' || typeof decoded.id !== 'string' || !Number.isInteger(decoded.sessionVersion)) return next(new Error('Unauthorized'));
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { status: true, sessionVersion: true },
    });
    if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== decoded.sessionVersion) return next(new Error('Unauthorized'));
    socket.data.session = { id: decoded.id, version: decoded.sessionVersion, expiresAt: decoded.exp ? decoded.exp * 1000 : 0 };
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const session = socket.data.session;
  const expiry = session.expiresAt ? setTimeout(() => socket.disconnect(true), Math.min(Math.max(0, session.expiresAt - Date.now()), 2147483647)) : undefined;
  const revalidate = setInterval(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { status: true, sessionVersion: true } });
      if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== session.version) socket.disconnect(true);
    } catch { socket.disconnect(true); }
  }, 30000);
  socket.on('disconnect', () => { clearInterval(revalidate); if (expiry) clearTimeout(expiry); });
  console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: config.isDev ? false : undefined,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.clientUrls.includes(origin)) return callback(null, true);
    const error = Object.assign(new Error('Origin not allowed'), { status: 403 });
    callback(error);
  },
  credentials: true,
}));
// Cookie-authenticated writes must originate from this site or an explicitly
// configured frontend. This also covers plain HTML forms that bypass CORS.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.headers.cookie || '';
  if (!cookie.includes(`${config.cookieName}=`) && !cookie.includes(`${config.customerCookieName}=`)) return next();
  const origin = req.headers.origin;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  if (!origin || (origin !== sameOrigin && !config.clientUrls.includes(origin))) {
    res.status(403).json({ success: false, message: 'Request origin is not allowed' });
    return;
  }
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req: any, _res, buffer) => { req.rawBody = Buffer.from(buffer); },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 500) {
      return sendJson({ success: false, message: 'Internal server error' });
    }
    return sendJson(body);
  }) as typeof res.json;
  next();
});
app.use('/uploads/media', express.static(path.resolve(__dirname, '../uploads/media'), {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: true,
  maxAge: '30d',
  setHeaders: (res) => { res.setHeader('X-Content-Type-Options', 'nosniff'); },
}));

// Global Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', apiLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    service: 'NIX Enterprise OMS & ERP API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/woocommerce', wooRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/messaging', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use('/api/media', mediaRoutes);
app.get('/api/builder/runtime.js', (_req, res) => { res.type('application/javascript').setHeader('Cache-Control', 'public, max-age=3600'); res.send(countdownRuntime); });
app.get('/api/builder/public-landings/:slug', publicLandingDesign);
app.use('/api/builder', builderRoutes);
app.get('/b/:slug', publicBuilderPage);
app.post('/b/:slug/forms/:formId', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: 'Too many form submissions. Please try again later.' }), submitBuilderForm);

// A production build is served by this same process, so the browser and API
// keep one origin. During development Vite continues to serve the client on
// port 3000 and proxy API requests to this server.
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (!config.isDev && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🚀 NIX OMS & ERP Server running on http://localhost:${PORT}`);
});
