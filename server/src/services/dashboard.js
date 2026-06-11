import { query } from '../db/pool.js';
import { getUserAssignments } from './assignments.js';
import { getRecentLessons } from './progress.js';

export async function getDashboardData(userId) {
  const assignments = await getUserAssignments(userId);
  const recentLessons = await getRecentLessons(userId, 5);

  let completedCourses = 0;
  let inProgressCourses = 0;
  let totalScore = 0;
  let scoredLessons = 0;

  assignments.forEach((assignment) => {
    if (assignment.progress === 100) completedCourses += 1;
    else if (assignment.progress > 0) inProgressCourses += 1;
  });

  const scoreResult = await query(
    `SELECT score FROM lesson_progress WHERE user_id = $1 AND completed = TRUE`,
    [userId]
  );
  scoreResult.rows.forEach((row) => {
    totalScore += row.score || 0;
    scoredLessons += 1;
  });

  const overallProgress = assignments.length > 0
    ? Math.round(assignments.reduce((sum, item) => sum + item.progress, 0) / assignments.length)
    : 0;

  return {
    stats: {
      completedCourses,
      inProgressCourses,
      progressPercent: overallProgress,
      avgScore: scoredLessons > 0 ? Math.round(totalScore / scoredLessons) : 0
    },
    assignments,
    recentLessons
  };
}

export async function getAdminStats() {
  const [users, courses, lessons, assignments, topCourses, activeUsers] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM users'),
    query('SELECT COUNT(*)::int AS count FROM courses'),
    query('SELECT COUNT(*)::int AS count FROM lessons'),
    query(
    `SELECT a.id,
            COUNT(l.id) AS lessons_count,
            COUNT(CASE WHEN p.completed THEN 1 END) AS completed_lessons
     FROM course_assignments a
     LEFT JOIN lessons l ON l.course_id = a.course_id
     LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = a.user_id
     GROUP BY a.id`
    ),
    query(
      `SELECT c.id,
              c.title,
              COUNT(DISTINCT a.id)::int AS assignments_count,
              COUNT(DISTINCT CASE WHEN p.completed THEN p.id END)::int AS completed_lessons,
              COUNT(DISTINCT l.id)::int AS lessons_count
       FROM courses c
       LEFT JOIN course_assignments a ON a.course_id = c.id
       LEFT JOIN lessons l ON l.course_id = c.id
       LEFT JOIN lesson_progress p ON p.course_id = c.id AND p.user_id = a.user_id AND p.lesson_id = l.id
       GROUP BY c.id
       ORDER BY assignments_count DESC, c.id
       LIMIT 5`
    ),
    query(
      `SELECT u.id,
              u.name,
              COUNT(DISTINCT CASE WHEN p.completed THEN p.id END)::int AS completed_lessons,
              COUNT(DISTINCT a.id)::int AS assignments_count
       FROM users u
       LEFT JOIN course_assignments a ON a.user_id = u.id
       LEFT JOIN lesson_progress p ON p.user_id = u.id
       WHERE u.role = 'user'
       GROUP BY u.id
       ORDER BY completed_lessons DESC, assignments_count DESC, u.id
       LIMIT 5`
    )
  ]);

  const items = assignments.rows.map((row) => {
    const lessonsCount = Number(row.lessons_count || 0);
    const completedLessons = Number(row.completed_lessons || 0);
    return lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0;
  });

  const completedAssignments = items.filter((value) => value === 100).length;

  return {
    totalUsers: users.rows[0]?.count || 0,
    totalCourses: courses.rows[0]?.count || 0,
    totalLessons: lessons.rows[0]?.count || 0,
    completionRate: items.length ? Math.round((completedAssignments / items.length) * 100) : 0,
    avgProgress: items.length ? Math.round(items.reduce((sum, value) => sum + value, 0) / items.length) : 0,
    topCourses: topCourses.rows.map((row) => {
      const lessonsCount = Number(row.lessons_count || 0);
      const completedLessons = Number(row.completed_lessons || 0);
      return {
        id: row.id,
        title: row.title,
        assignmentsCount: Number(row.assignments_count || 0),
        avgProgress: lessonsCount > 0 ? Math.round((completedLessons / Math.max(lessonsCount * Number(row.assignments_count || 0), 1)) * 100) : 0
      };
    }),
    activeUsers: activeUsers.rows.map((row) => ({
      id: row.id,
      name: row.name,
      completedLessons: Number(row.completed_lessons || 0),
      assignmentsCount: Number(row.assignments_count || 0)
    }))
  };
}
