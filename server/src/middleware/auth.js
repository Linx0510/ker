import { verifyAccessToken } from '../utils/jwt.js';
import { findUserById, mapUser } from '../services/users.js';
import { err } from '../utils/httpError.js';

export async function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  if (!token) {
    return next(err(401, 'AUTHENTICATION_REQUIRED'));
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);
    if (!user) {
      return next(err(401, 'USER_NOT_FOUND'));
    }
    if (user.status === 'pending' && user.role !== 'admin') {
      return next(err(403, 'ACCOUNT_PENDING'));
    }
    req.user = mapUser(user);
    return next();
  } catch (_error) {
    return next(err(401, 'INVALID_TOKEN'));
  }
}

export function requireRole(role) {
  return function roleGuard(req, _res, next) {
    if (!req.user || req.user.role !== role) {
      return next(err(403, 'FORBIDDEN'));
    }
    return next();
  };
}
