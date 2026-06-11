import { msg } from '../i18n/ru.js';

export function httpError(status, message, code = 'REQUEST_ERROR', details = []) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

export function err(status, code, params = {}, details = []) {
  return httpError(status, msg(code, params), code, details);
}
