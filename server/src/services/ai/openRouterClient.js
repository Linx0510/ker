import crypto from 'crypto';
import { env } from '../../config/env.js';
import { err } from '../../utils/httpError.js';

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function extractJson(content) {
  const text = String(content || '').trim();
  if (!text) return null;

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  try {
    return JSON.parse(candidate);
  } catch (_error) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (_nestedError) {
      return null;
    }
  }
}

export async function openRouterCompletion({ model, prompt }) {
  if (!env.openRouterApiKey) {
    throw err(500, 'AI_NOT_CONFIGURED');
  }

  const { signal, clear } = createTimeoutSignal(env.aiTimeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${env.openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kerama-marazzi.local',
        'X-Title': 'Kerama LMS AI'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Ты работаешь в LMS-системе и возвращаешь строго валидный JSON.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (response.status === 429) {
      throw err(429, 'AI_RATE_LIMIT');
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.metadata?.raw || payload?.error?.message || payload?.message || 'AI provider failed';
      if (response.status === 429 || /rate-limit|rate limit|temporarily rate-limited/i.test(message)) {
        throw err(429, 'AI_RATE_LIMIT');
      }
      if (response.status === 402 || /insufficient_quota|out of credits|quota/i.test(message)) {
        throw err(402, 'AI_QUOTA_EXCEEDED');
      }
      if (response.status === 404 && /no endpoints found/i.test(message)) {
        throw err(502, 'AI_MODEL_UNAVAILABLE');
      }
      if (/context/i.test(message)) {
        throw err(400, 'AI_CONTEXT_OVERFLOW');
      }
      throw err(502, 'AI_GENERATION_FAILED', { providerMessage: message });
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw err(502, 'AI_EMPTY_RESPONSE');
    }

    const parsed = extractJson(content);
    if (!parsed) {
      throw err(502, 'AI_MALFORMED_RESPONSE');
    }

    return {
      model,
      durationMs: Date.now() - startedAt,
      requestPayloadHash: crypto.createHash('sha256').update(prompt).digest('hex'),
      output: parsed,
      usage: payload?.usage || {}
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw err(504, 'AI_TIMEOUT');
    }
    throw error;
  } finally {
    clear();
  }
}
