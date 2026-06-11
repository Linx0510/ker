import crypto from 'crypto';
import { env } from '../../config/env.js';
import { err } from '../../utils/httpError.js';
import { openRouterCompletion } from './openRouterClient.js';
import { getCachedAiResponse, setCachedAiResponse } from './cache.js';

export const FREE_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-20b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free'
];

function shouldRetry(error) {
  if (!error) return false;
  return ['AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_EMPTY_RESPONSE', 'AI_MALFORMED_RESPONSE', 'AI_MODEL_UNAVAILABLE', 'AI_QUOTA_EXCEEDED'].includes(error.code);
}

function createCacheKey(prompt, generationType) {
  return crypto.createHash('sha256').update(`${generationType}:${prompt}`).digest('hex');
}

export async function generateWithFallback({ prompt, generationType }) {
  const cacheKey = createCacheKey(prompt, generationType);
  const cached = getCachedAiResponse(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true, cacheKey };
  }

  const fallbackChain = [];
  let lastError = null;

  for (const model of FREE_MODELS) {
    try {
      const result = await openRouterCompletion({ model, prompt });
      const payload = { ...result, fallbackChain: [...fallbackChain, model], fromCache: false, cacheKey };
      setCachedAiResponse(cacheKey, payload);
      return payload;
    } catch (error) {
      fallbackChain.push(model);
      lastError = error;
      if (!shouldRetry(error)) break;
    }
  }

  if (lastError?.code) throw lastError;
  throw err(502, 'AI_GENERATION_FAILED');
}
