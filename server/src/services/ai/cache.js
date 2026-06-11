import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 300,
  ttl: 1000 * 60 * 60
});

export function getCachedAiResponse(key) {
  return cache.get(key);
}

export function setCachedAiResponse(key, value) {
  cache.set(key, value);
}
