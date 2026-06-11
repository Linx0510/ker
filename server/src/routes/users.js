import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardData } from '../services/dashboard.js';
import { buildCertificatePdf, buildContentDisposition } from '../services/certificates.js';
import { listAssignedCourses } from '../services/courses.js';
import { listDepartments, listPositions } from '../services/departments.js';
import { updateUserNotifications, updateUserPassword, updateUserProfile, findUserById, mapUser } from '../services/users.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me/courses', asyncHandler(async (req, res) => {
  const result = await listAssignedCourses(req.user.id, { search: req.query.search });
  res.json(result);
}));

router.get('/me/directories/departments', asyncHandler(async (_req, res) => {
  const items = await listDepartments();
  res.json({ items });
}));

router.get('/me/directories/departments/:departmentId/positions', asyncHandler(async (req, res) => {
  const items = await listPositions(Number(req.params.departmentId));
  res.json({ items });
}));

router.get('/me/dashboard', asyncHandler(async (req, res) => {
  const dashboard = await getDashboardData(req.user.id);
  res.json(dashboard);
}));

router.get('/me/profile', asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  res.json({ user: mapUser(user) });
}));

router.patch('/me/profile', asyncHandler(async (req, res) => {
  const updated = await updateUserProfile(req.user.id, req.body);
  res.json({ user: mapUser(updated) });
}));

router.patch('/me/password', asyncHandler(async (req, res) => {
  await updateUserPassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.status(204).send();
}));

router.patch('/me/notifications', asyncHandler(async (req, res) => {
  const updated = await updateUserNotifications(req.user.id, req.body.notifications);
  res.json({ user: mapUser(updated) });
}));

router.get('/me/certificates/:assignmentId/pdf', asyncHandler(async (req, res) => {
  const { pdf, filename } = await buildCertificatePdf(req.user.id, Number(req.params.assignmentId));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', buildContentDisposition(filename));
  res.send(pdf);
}));

export default router;
