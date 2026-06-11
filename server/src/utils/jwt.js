import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessTtl }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user.id), type: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}
