import { query } from '../db/pool.js';
import { getLessonById } from './courses.js';
import { findUserAssignment, requireUserAssignment } from './assignments.js';
import { listQuestionsForLesson, scoreAnswers } from './lessonQuestions.js';
import { err } from '../utils/httpError.js';

export async function completeLesson(userId, lessonId, payload = {}) {
  const lesson = await getLessonById(lessonId);
  await requireUserAssignment(userId, lesson.course_id);
  const existingProgressResult = await query(
    'SELECT completed, score, completed_at FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
    [userId, lessonId]
  );
  const existingProgress = existingProgressResult.rows[0] || null;

  const questions = await listQuestionsForLesson(lessonId);
  let normalizedScore = 100;
  if (questions.length) {
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    normalizedScore = scoreAnswers(questions, answers);
    const passThreshold = Number(payload.passThreshold) || 70;
    if (normalizedScore < passThreshold) {
      throw err(400, 'TEST_FAILED', { score: normalizedScore, passThreshold }, [
        { score: normalizedScore, passThreshold }
      ]);
    }
  } else if (Number.isFinite(payload.score)) {
    normalizedScore = Math.max(0, Math.min(100, Math.round(payload.score)));
  }

  await query(
    `INSERT INTO lesson_progress (user_id, course_id, lesson_id, completed, score, completed_at)
     VALUES ($1, $2, $3, TRUE, $4, NOW())
     ON CONFLICT (user_id, lesson_id)
     DO UPDATE SET completed = TRUE, score = EXCLUDED.score, completed_at = NOW()`,
    [userId, lesson.course_id, lessonId, normalizedScore]
  );
  return {
    lesson,
    wasRetake: Boolean(existingProgress?.completed),
    previousScore: Number(existingProgress?.score || 0),
    score: normalizedScore
  };
}

export async function getCourseProgress(userId, courseId) {
  const assignment = await findUserAssignment(userId, courseId);
  const result = await query(
    `SELECT l.id AS lesson_id,
            l.sort_order,
            l.title,
            l.duration,
            p.completed,
            p.score,
            p.completed_at
     FROM lessons l
     LEFT JOIN lesson_progress p
       ON p.lesson_id = l.id AND p.user_id = $1
     WHERE l.course_id = $2
     ORDER BY l.sort_order, l.id`,
    [userId, courseId]
  );

  const lessons = result.rows.map((row) => ({
    lessonId: row.lesson_id,
    order: row.sort_order,
    title: row.title,
    duration: row.duration,
    completed: Boolean(row.completed),
    score: row.score || 0,
    completedAt: row.completed_at
  }));

  const completedLessons = lessons.filter((lesson) => lesson.completed).length;
  const percent = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;
  return {
    isEnrolled: Boolean(assignment),
    assignmentId: assignment?.id || null,
    percent,
    lessons
  };
}

export async function getRecentLessons(userId, limit = 5) {
  const result = await query(
    `SELECT p.score, p.completed_at, l.title AS lesson_title, c.title AS course_title
     FROM lesson_progress p
     JOIN lessons l ON l.id = p.lesson_id
     JOIN courses c ON c.id = p.course_id
     WHERE p.user_id = $1 AND p.completed = TRUE
     ORDER BY p.completed_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
