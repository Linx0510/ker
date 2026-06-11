import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { createUser, mapUser, validateCredentials, findUserById } from '../services/users.js';
import { listDepartments, listPositions } from '../services/departments.js';
import { persistRefreshToken, findRefreshToken, revokeRefreshToken } from '../services/tokens.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { err } from '../utils/httpError.js';
import { msg } from '../i18n/ru.js';
import { env } from '../config/env.js';

const router = express.Router();

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/api/auth'
  };
}

async function issueTokens(user, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const decoded = verifyRefreshToken(refreshToken);
  await persistRefreshToken(user.id, refreshToken, new Date(decoded.exp * 1000));
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  return { accessToken, user: mapUser(user) };
}

router.get('/directories/departments', asyncHandler(async (_req, res) => {
  const items = await listDepartments();
  res.json({ items });
}));

router.get('/directories/departments/:departmentId/positions', asyncHandler(async (req, res) => {
  const items = await listPositions(Number(req.params.departmentId));
  res.json({ items });
}));

router.post('/register', asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, role: 'user', status: 'pending' });
  res.status(201).json({
    pending: true,
    message: msg('REGISTRATION_SUBMITTED'),
    user: mapUser(user)
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const user = await validateCredentials(req.body.email, req.body.password);
  if (user.status === 'pending') {
    throw err(403, 'ACCOUNT_PENDING');
  }
  const tokens = await issueTokens(user, res);
  res.json(tokens);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw err(401, 'REFRESH_TOKEN_MISSING');
  verifyRefreshToken(token);
  const storedToken = await findRefreshToken(token);
  if (!storedToken) throw err(401, 'REFRESH_TOKEN_INVALID');
  const user = await findUserById(storedToken.user_id);
  if (!user) throw err(401, 'USER_NOT_FOUND');
  const accessToken = signAccessToken(user);
  res.json({ accessToken, user: mapUser(user) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    await revokeRefreshToken(token);
  }
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.status(204).send();
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

export default router;
