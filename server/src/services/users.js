import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { err } from '../utils/httpError.js';
import { env } from '../config/env.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw err(400, 'FIELD_REQUIRED', { fieldName }, [{ field: fieldName }]);
  }
  return value.trim();
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw err(400, 'EMAIL_REQUIRED', {}, [{ field: 'email' }]);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw err(400, 'EMAIL_INVALID', {}, [{ field: 'email' }]);
  }
  const domain = normalized.split('@')[1];
  if (env.allowedEmailDomain && domain !== env.allowedEmailDomain.toLowerCase()) {
    throw err(400, 'EMAIL_DOMAIN_FORBIDDEN', { domain: env.allowedEmailDomain }, [{ field: 'email' }]);
  }
  return normalized;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw err(400, 'PASSWORD_TOO_SHORT', {}, [{ field: 'password' }]);
  }
  return password;
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    phone: row.phone,
    position: row.position_name || row.position,
    department: row.department_name || row.department,
    departmentId: row.department_id || null,
    positionId: row.position_id || null,
    company: row.company,
    bio: row.bio,
    notifications: row.notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const USER_SELECT = `SELECT u.*,
  d.name AS department_name,
  p.name AS position_name
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN positions p ON p.id = u.position_id`;

export async function findUserByEmail(email) {
  const result = await query(`${USER_SELECT} WHERE u.email = $1`, [normalizeEmail(email)]);
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function createUser(payload) {
  const name = requireNonEmptyString(payload.name, 'Name');
  const email = validateEmail(payload.email);
  const password = validatePassword(payload.password);
  const existing = await findUserByEmail(email);
  if (existing) {
    throw err(409, 'EMAIL_EXISTS');
  }

  const role = payload.role === 'admin' ? 'admin' : 'user';
  const status = role === 'admin' ? 'active' : (payload.status || 'active');

  const passwordHash = await bcrypt.hash(password, 10);
  const { departmentId, positionId, department, position } = await resolveDepartmentPositionFields(payload);
  await query(
    `INSERT INTO users (name, email, password_hash, role, status, phone, position, department, company, bio, department_id, position_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      name,
      email,
      passwordHash,
      role,
      status,
      normalizeOptionalText(payload.phone),
      position,
      department,
      normalizeOptionalText(payload.company) || 'Kerama Marazzi',
      normalizeOptionalText(payload.bio),
      departmentId,
      positionId
    ]
  );
  return findUserByEmail(email);
}

export async function approveUser(userId) {
  const user = await findUserById(userId);
  if (!user) throw err(404, 'USER_NOT_FOUND');
  if (user.role === 'admin') {
    throw err(400, 'ADMIN_ALREADY_ACTIVE');
  }
  const result = await query(
    `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

export async function listUsersPaginated({ page = 1, limit = 20, status } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  const where = [];

  if (status) {
    params.push(status);
    where.push(`u.status = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS count FROM users u ${whereClause}`, params);
  params.push(safeLimit, offset);
  const result = await query(
    `${USER_SELECT} ${whereClause} ORDER BY u.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(mapUser),
    page: safePage,
    limit: safeLimit,
    total: countResult.rows[0]?.count || 0
  };
}

async function resolveDepartmentPositionFields(payload) {
  let departmentId = payload.departmentId ? Number(payload.departmentId) : null;
  let positionId = payload.positionId ? Number(payload.positionId) : null;
  let department = normalizeOptionalText(payload.department);
  let position = normalizeOptionalText(payload.position);

  if (departmentId && !Number.isFinite(departmentId)) departmentId = null;
  if (positionId && !Number.isFinite(positionId)) positionId = null;

  try {
    await query('SELECT 1 FROM departments LIMIT 1');
  } catch (_error) {
    return { departmentId: null, positionId: null, department, position };
  }

  if (departmentId) {
    const dept = await query('SELECT name FROM departments WHERE id = $1', [departmentId]);
    if (!dept.rowCount) throw err(400, 'DEPARTMENT_NOT_FOUND');
    department = dept.rows[0].name;
  }
  if (positionId) {
    const pos = await query('SELECT name, department_id FROM positions WHERE id = $1', [positionId]);
    if (!pos.rowCount) throw err(400, 'POSITION_NOT_FOUND');
    position = pos.rows[0].name;
    const posDeptId = Number(pos.rows[0].department_id);
    if (departmentId && posDeptId !== departmentId) {
      throw err(400, 'POSITION_DEPARTMENT_MISMATCH');
    }
    if (!departmentId) departmentId = posDeptId;
    if (!department) {
      const dept = await query('SELECT name FROM departments WHERE id = $1', [departmentId]);
      department = dept.rows[0]?.name || department;
    }
  }

  return { departmentId, positionId, department, position };
}

export async function updateUserProfile(userId, payload) {
  const existingUser = await findUserById(userId);
  if (!existingUser) {
    throw err(404, 'USER_NOT_FOUND');
  }

  const name = requireNonEmptyString(payload.name, 'Name');
  const email = validateEmail(payload.email);
  const emailOwner = await findUserByEmail(email);
  if (emailOwner && emailOwner.id !== userId) {
    throw err(409, 'EMAIL_EXISTS');
  }

  const { departmentId, positionId, department, position } = await resolveDepartmentPositionFields(payload);

  await query(
    `UPDATE users
     SET name = $2,
         email = $3,
         phone = $4,
         position = $5,
         department = $6,
         company = $7,
         bio = $8,
         department_id = $9,
         position_id = $10,
         updated_at = NOW()
     WHERE id = $1`,
    [
      userId,
      name,
      email,
      normalizeOptionalText(payload.phone),
      position,
      department,
      normalizeOptionalText(payload.company) || 'Kerama Marazzi',
      normalizeOptionalText(payload.bio),
      departmentId,
      positionId
    ]
  );
  return findUserById(userId);
}

export async function updateUserNotifications(userId, notifications) {
  const result = await query(
    `UPDATE users SET notifications = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, JSON.stringify(notifications)]
  );
  return result.rows[0];
}

export async function updateUserPassword(userId, currentPassword, newPassword) {
  const user = await findUserById(userId);
  if (!user) throw err(404, 'USER_NOT_FOUND');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw err(400, 'INVALID_PASSWORD');
  }

  validatePassword(newPassword);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash]);
}

export async function validateCredentials(email, password) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw err(401, 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw err(401, 'INVALID_CREDENTIALS');
  }

  return user;
}
