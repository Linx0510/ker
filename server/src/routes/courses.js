import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getCourseById, listCourses } from '../services/courses.js';
import { assignCourse } from '../services/assignments.js';
import { completeLesson, getCourseProgress } from '../services/progress.js';
import { err } from '../utils/httpError.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await listCourses(req.query);
  res.json(result);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const course = await getCourseById(Number(req.params.id));
  res.json({ course });
}));

router.get('/:id/progress', requireAuth, asyncHandler(async (req, res) => {
  const progress = await getCourseProgress(req.user.id, Number(req.params.id));
  res.json(progress);
}));

router.post('/:id/enroll', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'user') {
    throw err(403, 'SELF_ENROLLMENT_DISABLED');
  }
  const assignment = await assignCourse(req.user.id, Number(req.params.id));
  res.status(assignment ? 201 : 200).json({ assignment });
}));

router.post('/lessons/:lessonId/complete', requireAuth, asyncHandler(async (req, res) => {
  const completion = await completeLesson(req.user.id, Number(req.params.lessonId), req.body || {});
  const progress = await getCourseProgress(req.user.id, completion.lesson.course_id);
  res.json({
    progress,
    score: progress.lessons.find((item) => item.lessonId === completion.lesson.id)?.score || 0,
    wasRetake: completion.wasRetake,
    previousScore: completion.previousScore
  });
}));

export default router;
