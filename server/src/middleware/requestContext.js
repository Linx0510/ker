import crypto from 'crypto';

export function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader('x-request-id', req.requestId);
  next();
}
