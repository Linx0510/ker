import { query } from '../db/pool.js';
import { err } from '../utils/httpError.js';

function requireName(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw err(400, 'FIELD_REQUIRED', { fieldName });
  }
  return value.trim();
}

export async function listDepartments() {
  const result = await query('SELECT id, name, created_at FROM departments ORDER BY name');
  return result.rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
}

export async function createDepartment(payload) {
  const name = requireName(payload.name, 'Department name');
  try {
    const result = await query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING id, name, created_at',
      [name]
    );
    return { id: result.rows[0].id, name: result.rows[0].name, createdAt: result.rows[0].created_at };
  } catch (error) {
    if (error.code === '23505') throw err(409, 'DEPARTMENT_EXISTS');
    throw error;
  }
}

export async function updateDepartment(id, payload) {
  const name = requireName(payload.name, 'Department name');
  const result = await query(
    'UPDATE departments SET name = $2 WHERE id = $1 RETURNING id, name, created_at',
    [id, name]
  );
  if (!result.rowCount) throw err(404, 'DEPARTMENT_NOT_FOUND');
  return { id: result.rows[0].id, name: result.rows[0].name, createdAt: result.rows[0].created_at };
}

export async function deleteDepartment(id) {
  const result = await query('DELETE FROM departments WHERE id = $1', [id]);
  if (!result.rowCount) throw err(404, 'DEPARTMENT_NOT_FOUND');
}

export async function listPositions(departmentId) {
  const result = await query(
    'SELECT id, department_id, name, created_at FROM positions WHERE department_id = $1 ORDER BY name',
    [departmentId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    createdAt: row.created_at
  }));
}

export async function createPosition(departmentId, payload) {
  const name = requireName(payload.name, 'Position name');
  const dept = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
  if (!dept.rowCount) throw err(404, 'DEPARTMENT_NOT_FOUND');

  try {
    const result = await query(
      'INSERT INTO positions (department_id, name) VALUES ($1, $2) RETURNING id, department_id, name, created_at',
      [departmentId, name]
    );
    const row = result.rows[0];
    return { id: row.id, departmentId: row.department_id, name: row.name, createdAt: row.created_at };
  } catch (error) {
    if (error.code === '23505') throw err(409, 'POSITION_EXISTS');
    throw error;
  }
}

export async function updatePosition(id, payload) {
  const name = requireName(payload.name, 'Position name');
  const result = await query(
    'UPDATE positions SET name = $2 WHERE id = $1 RETURNING id, department_id, name, created_at',
    [id, name]
  );
  if (!result.rowCount) throw err(404, 'POSITION_NOT_FOUND');
  const row = result.rows[0];
  return { id: row.id, departmentId: row.department_id, name: row.name, createdAt: row.created_at };
}

export async function deletePosition(id) {
  const result = await query('DELETE FROM positions WHERE id = $1', [id]);
  if (!result.rowCount) throw err(404, 'POSITION_NOT_FOUND');
}

export async function resolveDepartmentPositionNames(departmentId, positionId) {
  if (!departmentId && !positionId) return { department: null, position: null };
  const result = await query(
    `SELECT d.name AS department_name, p.name AS position_name
     FROM departments d
     FULL OUTER JOIN positions p ON p.id = $2
     WHERE ($1::bigint IS NULL OR d.id = $1)`,
    [departmentId || null, positionId || null]
  );
  const row = result.rows[0];
  return {
    department: row?.department_name || null,
    position: row?.position_name || null
  };
}
