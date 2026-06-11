import { query } from '../db/pool.js';
import { err } from '../utils/httpError.js';

export async function assignCourse(userId, courseId) {
  const [userResult, courseResult] = await Promise.all([
    query('SELECT id FROM users WHERE id = $1', [userId]),
    query('SELECT id FROM courses WHERE id = $1', [courseId])
  ]);
  if (!userResult.rowCount) {
    throw err(404, 'USER_NOT_FOUND');
  }
  if (!courseResult.rowCount) {
    throw err(404, 'COURSE_NOT_FOUND');
  }

  try {
    const result = await query(
      `INSERT INTO course_assignments (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING *`,
      [userId, courseId]
    );
    return result.rows[0] || null;
  } catch (_error) {
    throw err(400, 'UNABLE_TO_ASSIGN');
  }
}

export async function findUserAssignment(userId, courseId) {
  const result = await query(
    'SELECT * FROM course_assignments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return result.rows[0] || null;
}

export async function requireUserAssignment(userId, courseId) {
  const assignment = await findUserAssignment(userId, courseId);
  if (!assignment) {
    throw err(403, 'COURSE_NOT_ASSIGNED');
  }
  return assignment;
}

export async function deleteAssignment(assignmentId) {
  const result = await query('DELETE FROM course_assignments WHERE id = $1', [assignmentId]);
  if (!result.rowCount) {
    throw err(404, 'ASSIGNMENT_NOT_FOUND');
  }
}

export async function getUserAssignments(userId) {
  const result = await query(
    `SELECT a.id,
            a.user_id,
            a.course_id,
            a.assigned_at,
            c.title,
            c.category,
            c.level,
            COUNT(DISTINCT l.id) AS lessons_count,
            COUNT(DISTINCT CASE WHEN p.completed THEN p.id END) AS completed_lessons
     FROM course_assignments a
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN lessons l ON l.course_id = c.id
     LEFT JOIN lesson_progress p ON p.course_id = c.id AND p.user_id = a.user_id AND p.lesson_id = l.id
     WHERE a.user_id = $1
     GROUP BY a.id, c.id
     ORDER BY a.assigned_at DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const lessonsCount = Number(row.lessons_count || 0);
    const completedLessons = Number(row.completed_lessons || 0);
    const progress = lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0;
    return {
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      assignedAt: row.assigned_at,
      progress,
      course: {
        id: row.course_id,
        title: row.title,
        category: row.category,
        level: row.level,
        lessonsCount
      }
    };
  });
}

export async function listAssignments() {
  const result = await query(
    `SELECT a.id,
            a.user_id,
            a.course_id,
            a.assigned_at,
            u.name AS user_name,
            c.title AS course_title,
            COUNT(DISTINCT l.id) AS lessons_count,
            COUNT(DISTINCT CASE WHEN p.completed THEN p.id END) AS completed_lessons
     FROM course_assignments a
     JOIN users u ON u.id = a.user_id
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN lessons l ON l.course_id = c.id
     LEFT JOIN lesson_progress p ON p.course_id = c.id AND p.user_id = a.user_id AND p.lesson_id = l.id
     GROUP BY a.id, u.name, c.title
     ORDER BY a.assigned_at DESC`
  );

  return result.rows.map((row) => {
    const lessonsCount = Number(row.lessons_count || 0);
    const completedLessons = Number(row.completed_lessons || 0);
    return {
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      assignedAt: row.assigned_at,
      userName: row.user_name,
      courseTitle: row.course_title,
      progress: lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0
    };
  });
}
