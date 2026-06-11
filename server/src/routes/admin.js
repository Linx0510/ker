import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { createCourse, createLesson, deleteCourse, deleteLesson, getCourseById, getLessonForAdmin, listCourses, updateCourse, updateLesson } from '../services/courses.js';
import { approveUser, createUser, findUserById, listUsersPaginated, mapUser, updateUserProfile } from '../services/users.js';
import { assignCourse, deleteAssignment, listAssignments } from '../services/assignments.js';
import { getAdminStats } from '../services/dashboard.js';
import { createQuestion, deleteQuestion, listAllLessonsAdmin, listQuestionsForLesson, updateQuestion } from '../services/lessonQuestions.js';
import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  listDepartments,
  listPositions,
  updateDepartment,
  updatePosition
} from '../services/departments.js';
import { err } from '../utils/httpError.js';
import { parseOrThrow, questionSchema } from '../validation/schemas.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', asyncHandler(async (_req, res) => {
  res.json(await getAdminStats());
}));

router.get('/users', asyncHandler(async (req, res) => {
  const result = await listUsersPaginated({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status
  });
  res.json(result);
}));

router.post('/users', asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, status: 'active' });
  res.status(201).json({ user: mapUser(user) });
}));

router.patch('/users/:id/approve', asyncHandler(async (req, res) => {
  const user = await approveUser(Number(req.params.id));
  res.json({ user: mapUser(user) });
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  const current = await findUserById(Number(req.params.id));
  if (!current) {
    throw err(404, 'USER_NOT_FOUND');
  }
  const user = await updateUserProfile(Number(req.params.id), { ...current, ...req.body });
  res.json({ user: mapUser(user) });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (req.user.id === userId) {
    throw err(400, 'CANNOT_DELETE_SELF');
  }
  const result = await query('DELETE FROM users WHERE id = $1', [userId]);
  if (!result.rowCount) {
    throw err(404, 'USER_NOT_FOUND');
  }
  res.status(204).send();
}));

router.get('/courses', asyncHandler(async (req, res) => {
  const result = await listCourses({ page: req.query.page, limit: req.query.limit });
  res.json(result);
}));

router.post('/courses', asyncHandler(async (req, res) => {
  const course = await createCourse(req.body);
  res.status(201).json({ course });
}));

router.patch('/courses/:id', asyncHandler(async (req, res) => {
  const course = await updateCourse(Number(req.params.id), req.body);
  res.json({ course });
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  await deleteCourse(Number(req.params.id));
  res.status(204).send();
}));

router.get('/courses/:id', asyncHandler(async (req, res) => {
  const course = await getCourseById(Number(req.params.id));
  res.json({ course });
}));

router.get('/lessons', asyncHandler(async (_req, res) => {
  const items = await listAllLessonsAdmin();
  res.json({ items });
}));

router.get('/lessons/:id', asyncHandler(async (req, res) => {
  const lesson = await getLessonForAdmin(Number(req.params.id));
  res.json({ lesson });
}));

router.post('/courses/:id/lessons', asyncHandler(async (req, res) => {
  const lesson = await createLesson(Number(req.params.id), req.body);
  res.status(201).json({ lesson });
}));

router.post('/lessons/:id/questions', asyncHandler(async (req, res) => {
  const payload = parseOrThrow(questionSchema, req.body);
  const question = await createQuestion(Number(req.params.id), payload);
  res.status(201).json({ question });
}));

router.get('/lessons/:id/questions', asyncHandler(async (req, res) => {
  const items = await listQuestionsForLesson(Number(req.params.id));
  res.json({ items });
}));

router.patch('/questions/:id', asyncHandler(async (req, res) => {
  const payload = parseOrThrow(questionSchema, req.body);
  const question = await updateQuestion(Number(req.params.id), payload);
  res.json({ question });
}));

router.delete('/questions/:id', asyncHandler(async (req, res) => {
  await deleteQuestion(Number(req.params.id));
  res.status(204).send();
}));

router.patch('/lessons/:id', asyncHandler(async (req, res) => {
  await updateLesson(Number(req.params.id), req.body);
  res.status(204).send();
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  await deleteLesson(Number(req.params.id));
  res.status(204).send();
}));

router.get('/assignments', asyncHandler(async (_req, res) => {
  const items = await listAssignments();
  res.json({ items });
}));

router.post('/assignments', asyncHandler(async (req, res) => {
  const assignment = await assignCourse(req.body.userId, req.body.courseId);
  res.status(assignment ? 201 : 200).json({ assignment });
}));

router.delete('/assignments/:id', asyncHandler(async (req, res) => {
  await deleteAssignment(Number(req.params.id));
  res.status(204).send();
}));

router.get('/departments', asyncHandler(async (_req, res) => {
  const items = await listDepartments();
  res.json({ items });
}));

router.post('/departments', asyncHandler(async (req, res) => {
  const department = await createDepartment(req.body);
  res.status(201).json({ department });
}));

router.patch('/departments/:id', asyncHandler(async (req, res) => {
  const department = await updateDepartment(Number(req.params.id), req.body);
  res.json({ department });
}));

router.delete('/departments/:id', asyncHandler(async (req, res) => {
  await deleteDepartment(Number(req.params.id));
  res.status(204).send();
}));

router.get('/departments/:departmentId/positions', asyncHandler(async (req, res) => {
  const items = await listPositions(Number(req.params.departmentId));
  res.json({ items });
}));

router.post('/departments/:departmentId/positions', asyncHandler(async (req, res) => {
  const position = await createPosition(Number(req.params.departmentId), req.body);
  res.status(201).json({ position });
}));

router.patch('/positions/:id', asyncHandler(async (req, res) => {
  const position = await updatePosition(Number(req.params.id), req.body);
  res.json({ position });
}));

router.delete('/positions/:id', asyncHandler(async (req, res) => {
  await deletePosition(Number(req.params.id));
  res.status(204).send();
}));

export default router;
