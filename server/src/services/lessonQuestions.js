import { query } from '../db/pool.js';
import { err } from '../utils/httpError.js';
import { getLessonById } from './courses.js';

function mapQuestionRow(row) {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    order: row.sort_order,
    type: row.question_type,
    question: row.question,
    options: row.options || [],
    correctIndex: row.correct_index,
    correctIndices: row.correct_indices || [],
    matchingPairs: row.matching_pairs || [],
    explanation: row.explanation || null,
    points: row.points || 1
  };
}

function normalizeQuestionPayload(payload) {
  const type = payload.type || 'single';
  const base = {
    order: Number(payload.order) || 1,
    question: String(payload.question || '').trim(),
    explanation: typeof payload.explanation === 'string' ? payload.explanation.trim() : null,
    points: Number(payload.points) || 1
  };
  if (!base.question) {
    throw err(400, 'FIELD_REQUIRED', { fieldName: 'Question' });
  }
  if (!['single', 'multiple', 'matching'].includes(type)) {
    throw err(400, 'AI_INVALID_GENERATION_TYPE');
  }
  if (type === 'matching') {
    const pairs = Array.isArray(payload.matchingPairs) ? payload.matchingPairs : [];
    if (pairs.length < 2) {
      throw err(400, 'ANSWER_OPTIONS_REQUIRED');
    }
    return {
      ...base,
      type,
      options: [],
      correctIndex: null,
      correctIndices: [],
      matchingPairs: pairs.map((pair) => ({
        left: String(pair.left || '').trim(),
        right: String(pair.right || '').trim()
      }))
    };
  }

  const options = Array.isArray(payload.options) ? payload.options.map((item) => String(item || '').trim()).filter(Boolean) : [];
  if (options.length < 2) {
    throw err(400, 'ANSWER_OPTIONS_REQUIRED');
  }
  if (type === 'multiple') {
    const correctIndices = Array.isArray(payload.correctIndices)
      ? payload.correctIndices.map((index) => Number(index)).filter((index) => Number.isInteger(index))
      : [];
    if (!correctIndices.length || correctIndices.some((index) => index < 0 || index >= options.length)) {
      throw err(400, 'INVALID_ANSWER_INDEX');
    }
    return {
      ...base,
      type,
      options,
      correctIndex: null,
      correctIndices: [...new Set(correctIndices)],
      matchingPairs: []
    };
  }

  const correctIndex = Number(payload.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    throw err(400, 'INVALID_ANSWER_INDEX');
  }
  return {
    ...base,
    type: 'single',
    options,
    correctIndex,
    correctIndices: [],
    matchingPairs: []
  };
}

export async function listQuestionsForLesson(lessonId) {
  const result = await query(
    `SELECT id, lesson_id, sort_order, question_type, question, options, correct_index,
            correct_indices, matching_pairs, explanation, points
     FROM lesson_questions
     WHERE lesson_id = $1
     ORDER BY sort_order, id`,
    [lessonId]
  );
  return result.rows.map(mapQuestionRow);
}

export async function getQuestionById(questionId) {
  const result = await query(
    `SELECT id, lesson_id, sort_order, question_type, question, options, correct_index,
            correct_indices, matching_pairs, explanation, points
     FROM lesson_questions
     WHERE id = $1`,
    [questionId]
  );
  const question = result.rows[0];
  if (!question) {
    throw err(404, 'NOT_FOUND');
  }
  return mapQuestionRow(question);
}

export async function listQuestionsForLessonPublic(lessonId) {
  const items = await listQuestionsForLesson(lessonId);
  return items.map((item) => {
    const type = ['single', 'multiple', 'matching'].includes(item.type) ? item.type : 'single';
    const safeOptions = Array.isArray(item.options) ? item.options.map((option) => String(option || '').trim()).filter(Boolean) : [];
    const safePairs = Array.isArray(item.matchingPairs)
      ? item.matchingPairs
        .map((pair) => ({
          left: String(pair?.left || '').trim(),
          right: String(pair?.right || '').trim()
        }))
        .filter((pair) => pair.left && pair.right)
      : [];
    return {
      id: item.id,
      order: Number(item.order) || 1,
      type,
      question: String(item.question || '').trim(),
      options: type === 'matching' ? [] : safeOptions,
      matchingPairs: type === 'matching' ? safePairs : [],
      explanation: item.explanation ? String(item.explanation).trim() : null,
      points: Math.max(Number(item.points) || 1, 1)
    };
  });
}

export async function listAllLessonsAdmin() {
  const result = await query(
    `SELECT l.id,
            l.course_id,
            l.sort_order,
            l.title,
            l.duration,
            c.title AS course_title,
            (SELECT COUNT(*)::int FROM lesson_questions q WHERE q.lesson_id = l.id) AS questions_count
     FROM lessons l
     JOIN courses c ON c.id = l.course_id
     ORDER BY c.id, l.sort_order, l.id`
  );
  return result.rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    order: row.sort_order,
    title: row.title,
    duration: row.duration,
    courseTitle: row.course_title,
    questionsCount: row.questions_count
  }));
}

export async function createQuestion(lessonId, payload) {
  await getLessonById(lessonId);
  const normalized = normalizeQuestionPayload(payload);
  const result = await query(
    `INSERT INTO lesson_questions (
       lesson_id, sort_order, question_type, question, options, correct_index,
       correct_indices, matching_pairs, explanation, points, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
     RETURNING id, lesson_id, sort_order, question_type, question, options, correct_index,
               correct_indices, matching_pairs, explanation, points`,
    [
      lessonId,
      normalized.order,
      normalized.type,
      normalized.question,
      JSON.stringify(normalized.options),
      normalized.correctIndex,
      JSON.stringify(normalized.correctIndices),
      JSON.stringify(normalized.matchingPairs),
      normalized.explanation,
      normalized.points
    ]
  );
  return mapQuestionRow(result.rows[0]);
}

export async function updateQuestion(questionId, payload) {
  const existing = await getQuestionById(questionId);
  const normalized = normalizeQuestionPayload({ ...existing, ...payload });
  const result = await query(
    `UPDATE lesson_questions
     SET sort_order = $2,
         question_type = $3,
         question = $4,
         options = $5::jsonb,
         correct_index = $6,
         correct_indices = $7::jsonb,
         matching_pairs = $8::jsonb,
         explanation = $9,
         points = $10,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, lesson_id, sort_order, question_type, question, options, correct_index,
               correct_indices, matching_pairs, explanation, points`,
    [
      questionId,
      normalized.order,
      normalized.type,
      normalized.question,
      JSON.stringify(normalized.options),
      normalized.correctIndex,
      JSON.stringify(normalized.correctIndices),
      JSON.stringify(normalized.matchingPairs),
      normalized.explanation,
      normalized.points
    ]
  );
  return mapQuestionRow(result.rows[0]);
}

export async function deleteQuestion(questionId) {
  const result = await query('DELETE FROM lesson_questions WHERE id = $1', [questionId]);
  if (!result.rowCount) {
    throw err(404, 'NOT_FOUND');
  }
}

function normalizeMatchingAnswer(answer) {
  if (!Array.isArray(answer?.matchingPairs)) return [];
  return answer.matchingPairs
    .map((pair) => ({
      left: String(pair.left || '').trim(),
      right: String(pair.right || '').trim()
    }))
    .filter((pair) => pair.left && pair.right);
}

function isMatchingCorrect(question, answer) {
  const expected = new Map((question.matchingPairs || []).map((pair) => [pair.left, pair.right]));
  const actual = new Map(normalizeMatchingAnswer(answer).map((pair) => [pair.left, pair.right]));
  if (expected.size !== actual.size) return false;
  for (const [left, right] of expected.entries()) {
    if (actual.get(left) !== right) return false;
  }
  return true;
}

function isMultipleCorrect(question, answer) {
  const selected = Array.isArray(answer?.selectedIndices)
    ? answer.selectedIndices.map((index) => Number(index)).filter((index) => Number.isInteger(index))
    : [];
  const expected = new Set((question.correctIndices || []).map((index) => Number(index)));
  const actual = new Set(selected);
  if (!expected.size || expected.size !== actual.size) return false;
  for (const index of expected.values()) {
    if (!actual.has(index)) return false;
  }
  return true;
}

function isSingleCorrect(question, answer) {
  return Number(answer?.selectedIndex) === Number(question.correctIndex);
}

export function scoreAnswers(questions, answers) {
  if (!questions.length) return 100;
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const totalPoints = questions.reduce((sum, question) => sum + Math.max(Number(question.points) || 1, 1), 0);
  let earnedPoints = 0;

  for (const question of questions) {
    const answer = safeAnswers.find((item) => Number(item.questionId) === Number(question.id));
    const points = Math.max(Number(question.points) || 1, 1);
    const isCorrect = question.type === 'multiple'
      ? isMultipleCorrect(question, answer)
      : question.type === 'matching'
        ? isMatchingCorrect(question, answer)
        : isSingleCorrect(question, answer);
    if (isCorrect) {
      earnedPoints += points;
    }
  }

  return totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 100;
}
