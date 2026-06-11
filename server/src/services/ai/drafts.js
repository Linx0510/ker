import { query, withTransaction } from '../../db/pool.js';
import { err } from '../../utils/httpError.js';

function mapDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    generationType: row.generation_type,
    status: row.status,
    input: row.input_payload || {},
    output: row.output_payload,
    error: row.error_text,
    requestedBy: row.requested_by,
    modelUsed: row.model_used,
    fallbackChain: row.fallback_chain || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function normalizeQuestionForValidation(question = {}, fallbackOrder = 1) {
  const type = String(question.type || 'single');
  const normalized = {
    order: Number(question.order) || fallbackOrder,
    type,
    question: String(question.question || '').trim(),
    options: Array.isArray(question.options) ? question.options.map((item) => String(item || '').trim()).filter(Boolean) : [],
    correctIndex: Number(question.correctIndex),
    correctIndices: Array.isArray(question.correctIndices) ? question.correctIndices.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : [],
    matchingPairs: Array.isArray(question.matchingPairs) ? question.matchingPairs : [],
    explanation: typeof question.explanation === 'string' ? question.explanation.trim() : null,
    points: Math.max(Number(question.points) || 1, 1)
  };

  if (!normalized.question) {
    throw err(400, 'FIELD_REQUIRED', { fieldName: 'Question' });
  }
  if (!['single', 'multiple', 'matching'].includes(normalized.type)) {
    throw err(400, 'AI_INVALID_GENERATION_TYPE');
  }
  if (normalized.type === 'single') {
    if (normalized.options.length < 2 || !Number.isInteger(normalized.correctIndex) || normalized.correctIndex < 0 || normalized.correctIndex >= normalized.options.length) {
      throw err(400, 'INVALID_ANSWER_INDEX');
    }
  }
  if (normalized.type === 'multiple') {
    if (normalized.options.length < 2 || !normalized.correctIndices.length) {
      throw err(400, 'ANSWER_OPTIONS_REQUIRED');
    }
  }
  if (normalized.type === 'matching') {
    const pairs = normalized.matchingPairs
      .map((pair) => ({
        left: String(pair?.left || '').trim(),
        right: String(pair?.right || '').trim()
      }))
      .filter((pair) => pair.left && pair.right);
    if (pairs.length < 2) {
      throw err(400, 'ANSWER_OPTIONS_REQUIRED');
    }
    normalized.matchingPairs = pairs;
  }
  return normalized;
}

function validateDraftOutput(generationType, output, inputPayload = {}) {
  if (!output || typeof output !== 'object') {
    throw err(400, 'AI_MALFORMED_RESPONSE');
  }
  if (generationType === 'course') {
    if (!String(output.title || '').trim()) throw err(400, 'FIELD_REQUIRED', { fieldName: 'Title' });
    if (!String(output.description || '').trim()) throw err(400, 'FIELD_REQUIRED', { fieldName: 'Description' });
    const lessons = Array.isArray(output.lessons) ? output.lessons : [];
    return {
      ...output,
      lessons: lessons.map((lesson, lessonIndex) => {
        const normalizedLesson = {
          order: Number(lesson?.order) || lessonIndex + 1,
          title: String(lesson?.title || '').trim() || `Урок ${lessonIndex + 1}`,
          duration: Math.max(Number(lesson?.duration) || 10, 0),
          content: String(lesson?.content || '').trim() || 'Контент будет заполнен позже',
          questions: Array.isArray(lesson?.questions)
            ? lesson.questions.map((question, questionIndex) => normalizeQuestionForValidation(question, questionIndex + 1))
            : []
        };
        return normalizedLesson;
      })
    };
  }
  if (generationType === 'lesson') {
    const courseId = Number(inputPayload?.courseId);
    if (!Number.isFinite(courseId)) throw err(400, 'FIELD_REQUIRED', { fieldName: 'courseId' });
    return {
      ...output,
      order: Number(output.order) || 1,
      title: String(output.title || '').trim() || 'AI Lesson',
      duration: Math.max(Number(output.duration) || 10, 0),
      content: String(output.content || '').trim() || 'Generated lesson',
      questions: Array.isArray(output.questions)
        ? output.questions.map((question, questionIndex) => normalizeQuestionForValidation(question, questionIndex + 1))
        : []
    };
  }
  if (generationType === 'test' || generationType === 'question' || generationType === 'matching') {
    const lessonId = Number(inputPayload?.lessonId);
    if (!Number.isFinite(lessonId)) throw err(400, 'FIELD_REQUIRED', { fieldName: 'lessonId' });
    const questions = Array.isArray(output.questions) ? output.questions : [output];
    return {
      questions: questions.map((question, index) => normalizeQuestionForValidation(
        generationType === 'matching' ? { ...question, type: 'matching' } : question,
        index + 1
      ))
    };
  }
  return output;
}

export async function createDraft({ generationType, input, requestedBy }) {
  const result = await query(
    `INSERT INTO ai_generation_drafts (generation_type, status, input_payload, requested_by, updated_at)
     VALUES ($1, 'pending', $2::jsonb, $3, NOW())
     RETURNING *`,
    [generationType, JSON.stringify(input || {}), requestedBy]
  );
  return mapDraft(result.rows[0]);
}

export async function markDraftProcessing(draftId) {
  const result = await query(
    `UPDATE ai_generation_drafts
     SET status = 'processing', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [draftId]
  );
  const draft = result.rows[0];
  if (!draft) {
    throw err(404, 'AI_DRAFT_NOT_FOUND');
  }
  return mapDraft(draft);
}

export async function markDraftDone(draftId, { output, modelUsed, fallbackChain }) {
  const result = await query(
    `UPDATE ai_generation_drafts
     SET status = 'done',
         output_payload = $2::jsonb,
         model_used = $3,
         fallback_chain = $4::jsonb,
         updated_at = NOW(),
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [draftId, JSON.stringify(output), modelUsed, JSON.stringify(fallbackChain || [])]
  );
  return mapDraft(result.rows[0]);
}

export async function markDraftError(draftId, errorText) {
  const result = await query(
    `UPDATE ai_generation_drafts
     SET status = 'error',
         error_text = $2,
         updated_at = NOW(),
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [draftId, errorText]
  );
  return mapDraft(result.rows[0]);
}

export async function getDraftById(draftId) {
  const result = await query('SELECT * FROM ai_generation_drafts WHERE id = $1', [draftId]);
  const draft = result.rows[0];
  if (!draft) {
    throw err(404, 'AI_DRAFT_NOT_FOUND');
  }
  return mapDraft(draft);
}

export async function listRecentDrafts(limit = 20) {
  const result = await query(
    'SELECT * FROM ai_generation_drafts ORDER BY created_at DESC LIMIT $1',
    [Math.max(1, Math.min(Number(limit) || 20, 100))]
  );
  return result.rows.map(mapDraft);
}

export async function logAiRequest({
  draftId,
  requestedBy,
  model,
  status,
  errorText,
  promptTokens,
  completionTokens,
  durationMs,
  requestPayload,
  responsePayload
}) {
  await query(
    `INSERT INTO ai_generation_logs (
       draft_id, requested_by, model, status, error_text, prompt_tokens, completion_tokens,
       duration_ms, request_payload, response_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
    [
      draftId,
      requestedBy,
      model,
      status,
      errorText || null,
      Number.isInteger(promptTokens) ? promptTokens : null,
      Number.isInteger(completionTokens) ? completionTokens : null,
      Number(durationMs) || 0,
      JSON.stringify(requestPayload || {}),
      responsePayload ? JSON.stringify(responsePayload) : null
    ]
  );
}

export async function listAiLogs(limit = 100) {
  const result = await query(
    `SELECT l.*, d.generation_type
     FROM ai_generation_logs l
     LEFT JOIN ai_generation_drafts d ON d.id = l.draft_id
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 200))]
  );
  return result.rows.map((row) => ({
    id: row.id,
    draftId: row.draft_id,
    generationType: row.generation_type || null,
    requestedBy: row.requested_by,
    model: row.model,
    status: row.status,
    error: row.error_text,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    durationMs: row.duration_ms,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    createdAt: row.created_at
  }));
}

export async function confirmDraft(draftId, outputOverride = null) {
  return withTransaction(async (client) => {
    const draftResult = await client.query('SELECT * FROM ai_generation_drafts WHERE id = $1 FOR UPDATE', [draftId]);
    const draft = draftResult.rows[0];
    if (!draft) throw err(404, 'AI_DRAFT_NOT_FOUND');
    if (draft.status !== 'done') {
      throw err(400, 'AI_DRAFT_NOT_READY');
    }

    const output = validateDraftOutput(draft.generation_type, outputOverride || draft.output_payload, draft.input_payload || {});

    if (draft.generation_type === 'course') {
      const courseRes = await client.query(
        `INSERT INTO courses (title, description, full_description, category, level, instructor, duration, image, audience)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
         RETURNING id`,
        [
          String(output.title || 'AI Course'),
          String(output.description || 'Generated by AI'),
          String(output.fullDescription || output.description || 'Generated by AI'),
          String(output.category || 'plita'),
          String(output.level || 'beginner'),
          'AI Assistant',
          Number(output.duration) || 0,
          'Сотрудники Kerama Marazzi'
        ]
      );
      const courseId = courseRes.rows[0].id;
      const lessons = Array.isArray(output.lessons) ? output.lessons : [];
      for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
        const lesson = lessons[lessonIndex];
        const lessonRes = await client.query(
          `INSERT INTO lessons (course_id, sort_order, title, duration, content, video_url)
           VALUES ($1, $2, $3, $4, $5, NULL)
           RETURNING id`,
          [
            courseId,
            Number(lesson.order) || lessonIndex + 1,
            String(lesson.title || `Урок ${lessonIndex + 1}`),
            Number(lesson.duration) || 10,
            String(lesson.content || 'Контент будет заполнен позже')
          ]
        );
        const lessonId = lessonRes.rows[0].id;
        const questions = Array.isArray(lesson.questions) ? lesson.questions : [];
        for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
          const question = questions[questionIndex];
          const type = String(question.type || 'single');
          await client.query(
            `INSERT INTO lesson_questions (
               lesson_id, sort_order, question_type, question, options, correct_index, correct_indices, matching_pairs, explanation, points, updated_at
             )
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())`,
            [
              lessonId,
              Number(question.order) || questionIndex + 1,
              type,
              String(question.question || 'Новый вопрос'),
              JSON.stringify(Array.isArray(question.options) ? question.options : []),
              type === 'single' ? Number(question.correctIndex) || 0 : null,
              JSON.stringify(Array.isArray(question.correctIndices) ? question.correctIndices : []),
              JSON.stringify(Array.isArray(question.matchingPairs) ? question.matchingPairs : []),
              question.explanation ? String(question.explanation) : null,
              Number(question.points) || 1
            ]
          );
        }
      }
    }

    if (draft.generation_type === 'lesson') {
      const courseId = Number(draft.input_payload?.courseId);
      if (!Number.isFinite(courseId)) {
        throw err(400, 'FIELD_REQUIRED', { fieldName: 'courseId' });
      }
      const lessonRes = await client.query(
        `INSERT INTO lessons (course_id, sort_order, title, duration, content, video_url)
         VALUES ($1, $2, $3, $4, $5, NULL)
         RETURNING id`,
        [
          courseId,
          Number(output.order) || 1,
          String(output.title || 'AI Lesson'),
          Number(output.duration) || 10,
          String(output.content || 'Generated lesson')
        ]
      );
      const lessonId = lessonRes.rows[0].id;
      const questions = Array.isArray(output.questions) ? output.questions : [];
      for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
        const question = questions[questionIndex];
        const type = String(question.type || 'single');
        await client.query(
          `INSERT INTO lesson_questions (
             lesson_id, sort_order, question_type, question, options, correct_index, correct_indices, matching_pairs, explanation, points, updated_at
           )
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())`,
          [
            lessonId,
            Number(question.order) || questionIndex + 1,
            type,
            String(question.question || 'Новый вопрос'),
            JSON.stringify(Array.isArray(question.options) ? question.options : []),
            type === 'single' ? Number(question.correctIndex) || 0 : null,
            JSON.stringify(Array.isArray(question.correctIndices) ? question.correctIndices : []),
            JSON.stringify(Array.isArray(question.matchingPairs) ? question.matchingPairs : []),
            question.explanation ? String(question.explanation) : null,
            Number(question.points) || 1
          ]
        );
      }
    }

    if (draft.generation_type === 'test' || draft.generation_type === 'question' || draft.generation_type === 'matching') {
      const lessonId = Number(draft.input_payload?.lessonId);
      if (!Number.isFinite(lessonId)) {
        throw err(400, 'FIELD_REQUIRED', { fieldName: 'lessonId' });
      }
      const questions = Array.isArray(output.questions)
        ? output.questions
        : [output];
      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        const type = String(question.type || (draft.generation_type === 'matching' ? 'matching' : 'single'));
        await client.query(
          `INSERT INTO lesson_questions (
             lesson_id, sort_order, question_type, question, options, correct_index, correct_indices, matching_pairs, explanation, points, updated_at
           )
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())`,
          [
            lessonId,
            Number(question.order) || index + 1,
            type,
            String(question.question || 'AI вопрос'),
            JSON.stringify(Array.isArray(question.options) ? question.options : []),
            type === 'single' ? Number(question.correctIndex) || 0 : null,
            JSON.stringify(Array.isArray(question.correctIndices) ? question.correctIndices : []),
            JSON.stringify(Array.isArray(question.matchingPairs) ? question.matchingPairs : []),
            question.explanation ? String(question.explanation) : null,
            Number(question.points) || 1
          ]
        );
      }
    }

    const updateResult = await client.query(
      `UPDATE ai_generation_drafts
       SET status = 'confirmed',
           output_payload = $2::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [draftId, JSON.stringify(output)]
    );
    return mapDraft(updateResult.rows[0]);
  });
}
