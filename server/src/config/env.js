import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function required(name, fallback = '') {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function jwtSecret(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  return devFallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 3003),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/kerama_lms'),
  jwtAccessSecret: jwtSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: jwtSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@kerama-marazzi.ru',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  adminName: process.env.ADMIN_NAME || 'Administrator Kerama Marazzi',
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || 'kerama-marazzi.ru',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:3003,http://89.108.108.88.31:3003')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  allowNullOrigin: process.env.ALLOW_NULL_ORIGIN === 'true',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  aiTimeoutMs: Math.max(Number(process.env.AI_TIMEOUT_MS) || 30000, 1000),
  aiMaxRetries: Math.max(Number(process.env.AI_MAX_RETRIES) || 3, 1),
  aiMaxPromptLength: Math.max(Number(process.env.AI_MAX_PROMPT_LENGTH) || 2000, 200),
  aiMaxGeneratedItems: Math.max(Number(process.env.AI_MAX_GENERATED_ITEMS) || 20, 1),
  aiRateLimitPerHour: Math.max(Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 10, 1)
};
