import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import courseRoutes from './routes/courses.js';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.clientOrigins.includes(origin)) return callback(null, true);
    if (origin === 'null' && env.allowNullOrigin) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
};

app.use(helmet({
  contentSecurityPolicy: env.isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"]
        }
      }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(requestContext);
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    }, 'Request completed');
  });
  next();
});
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '4mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.', code: 'RATE_LIMIT', details: [] }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/ai', aiRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(rootDir));

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    return next();
  }
  if (path.extname(req.path)) {
    return next();
  }
  return res.sendFile(path.join(rootDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, `Server listening on http://localhost:${env.port}`);
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down server');
  server.close(() => {
    logger.info('Server stopped');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
