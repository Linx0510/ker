import { query } from '../db/pool.js';

export async function persistRefreshToken(userId, token, expiresAt) {
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

export async function findRefreshToken(token) {
  const result = await query('SELECT * FROM refresh_tokens WHERE token = $1', [token]);
  return result.rows[0] || null;
}

export async function revokeRefreshToken(token) {
  await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}
