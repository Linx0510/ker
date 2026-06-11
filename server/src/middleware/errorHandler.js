import { msg } from '../i18n/ru.js';
import { getRequestLogger } from '../utils/logger.js';

function mapPostgresError(error) {
  if (!error?.code) return error;
  if (error.code === '23505' && !error.status) {
    return {
      ...error,
      status: 409,
      code: 'REQUEST_CONFLICT',
      message: msg('REQUEST_CONFLICT')
    };
  }
  if (error.code === '23503' && !error.status) {
    return {
      ...error,
      status: 400,
      code: 'FK_CONSTRAINT_FAILED',
      message: msg('FK_CONSTRAINT_FAILED')
    };
  }
  return error;
}

export function errorHandler(error, req, res, _next) {
  const normalizedError = mapPostgresError(error);
  const status = normalizedError.status || 500;
  const requestLogger = getRequestLogger(req);
  if (status >= 500) {
    requestLogger.error({
      err: normalizedError,
      message: normalizedError.stack || normalizedError.message
    }, 'Unhandled request error');
  } else {
    requestLogger.warn({
      err: normalizedError,
      message: normalizedError.message
    }, 'Handled request error');
  }

  res.status(status).json({
    error: normalizedError.message || msg('INTERNAL_ERROR'),
    code: normalizedError.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    details: normalizedError.details || []
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: msg('ROUTE_NOT_FOUND'),
    code: 'ROUTE_NOT_FOUND',
    details: []
  });
}
