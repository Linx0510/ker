import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { parseOrThrow, aiConfirmSchema, aiGenerateSchema } from '../validation/schemas.js';
import { confirmDraft, listAiLogs, listRecentDrafts } from '../services/ai/drafts.js';
import { enqueueGeneration, getDraftStatus, processDraft } from '../services/ai/generator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.aiRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Лимит AI-запросов исчерпан', code: 'AI_RATE_LIMIT', details: [] }
});

const draftReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком частое обновление статуса черновика', code: 'AI_RATE_LIMIT', details: [] }
});

router.use(requireAuth, requireRole('admin'));

router.post('/generate', generateLimiter, asyncHandler(async (req, res) => {
  const payload = parseOrThrow(aiGenerateSchema, req.body, 'REQUEST_ERROR');
  const draft = await enqueueGeneration({
    generationType: payload.generationType,
    input: payload.input,
    requestedBy: req.user.id
  });

  setImmediate(async () => {
    try {
      await processDraft(draft.id);
    } catch (error) {
      logger.warn({
        draftId: draft.id,
        requestId: req.requestId,
        code: error.code,
        error: error.message
      }, 'Async AI draft processing failed');
    }
  });

  res.status(202).json({ draft });
}));

router.get('/drafts', asyncHandler(async (req, res) => {
  const items = await listRecentDrafts(req.query.limit);
  res.json({ items });
}));

router.get('/drafts/:id', draftReadLimiter, asyncHandler(async (req, res) => {
  const draft = await getDraftStatus(Number(req.params.id));
  res.json({ draft });
}));

router.post('/drafts/:id/confirm', asyncHandler(async (req, res) => {
  const payload = parseOrThrow(aiConfirmSchema, req.body || {}, 'REQUEST_ERROR');
  const draft = await confirmDraft(Number(req.params.id), payload.output || null);
  res.json({ draft });
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const items = await listAiLogs(req.query.limit);
  res.json({ items });
}));

export default router;
