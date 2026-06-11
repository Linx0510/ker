import { env } from '../../config/env.js';
import { err } from '../../utils/httpError.js';

const blockedTokens = [
  'ignore previous instructions',
  'system prompt',
  'reveal prompt',
  '<script',
  '</script>',
  'DROP TABLE',
  'DELETE FROM'
];

function sanitizeString(value) {
  const source = String(value || '').replace(/\u0000/g, '').trim();
  if (source.length > env.aiMaxPromptLength) {
    throw err(400, 'AI_PROMPT_TOO_LONG', { maxLength: env.aiMaxPromptLength });
  }
  const lowered = source.toLowerCase();
  let output = source;
  for (const token of blockedTokens) {
    if (lowered.includes(token.toLowerCase())) {
      output = output.replace(new RegExp(token, 'ig'), '[filtered]');
    }
  }
  return output;
}

export function sanitizePromptInput(input) {
  const safe = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (typeof value === 'string') {
      safe[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      safe[key] = value.map((item) => (typeof item === 'string' ? sanitizeString(item) : item));
    } else {
      safe[key] = value;
    }
  }
  return safe;
}
