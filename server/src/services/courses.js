import { query, withTransaction } from '../db/pool.js';
import { err } from '../utils/httpError.js';
import { listQuestionsForLesson, listQuestionsForLessonPublic } from './lessonQuestions.js';

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw err(400, 'FIELD_REQUIRED', { fieldName });
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizePositiveNumber(value, fieldName, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw err(400, 'INVALID_NUMBER', { fieldName });
  }
  return numericValue;
}

function mapCourse(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fullDescription: row.full_description,
    category: row.category,
    level: row.level,
    instructor: row.instructor,
    duration: row.duration,
    image: row.image,
    audience: row.audience,
    studentsCount: Number(row.students_count || 0),
    lessonsCount: Number(row.lessons_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listAssignedCourses(userId, filters = {}) {
  const params = [userId];
  const where = ['a.user_id = $1'];

  if (filters.search) {
    params.push(`%${String(filters.search).toLowerCase()}%`);
    where.push(`(LOWER(c.title) LIKE $${params.length} OR LOWER(c.description) LIKE $${params.length})`);
  }

  const whereClause = where.join(' AND ');
  const result = await query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = c.id) AS lessons_count,
            (SELECT COUNT(*)::int
             FROM lesson_questions q
             JOIN lessons lq ON lq.id = q.lesson_id
             WHERE lq.course_id = c.id) AS questions_count,
            (SELECT COUNT(*)::int
             FROM lessons l
             JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1 AND lp.completed = TRUE
             WHERE l.course_id = c.id) AS completed_lessons
     FROM course_assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE ${whereClause}
     ORDER BY c.title`,
    params
  );

  return {
    items: result.rows.map((row) => {
      const lessonsCount = Number(row.lessons_count || 0);
      const questionsCount = Number(row.questions_count || 0);
      const completedLessons = Number(row.completed_lessons || 0);
      const progressPercent = lessonsCount ? Math.round((completedLessons / lessonsCount) * 100) : 0;
      return {
        ...mapCourse(row),
        lessonsCount,
        questionsCount,
        hasTests: questionsCount > 0,
        progressPercent
      };
    })
  };
}

export async function listCourses(filters = {}) {
  const params = [];
  const where = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(c.title) LIKE $${params.length} OR LOWER(c.description) LIKE $${params.length})`);
  }
  if (filters.category && filters.category !== 'all') {
    params.push(filters.category);
    where.push(`c.category = $${params.length}`);
  }
  if (filters.level && filters.level !== 'all') {
    params.push(filters.level);
    where.push(`c.level = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const safePage = Math.max(Number(filters.page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(`SELECT COUNT(*)::int AS count FROM courses c ${whereClause}`, params);
  params.push(safeLimit, offset);

  const result = await query(
    `SELECT c.*,
            (SELECT COUNT(DISTINCT a.user_id) FROM course_assignments a WHERE a.course_id = c.id) AS students_count,
            (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = c.id) AS lessons_count
     FROM courses c
     ${whereClause}
     ORDER BY c.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(mapCourse),
    page: safePage,
    limit: safeLimit,
    total: countResult.rows[0]?.count || 0
  };
}

export async function getCourseById(courseId) {
  const result = await query(
    `SELECT c.*,
            (SELECT COUNT(DISTINCT a.user_id) FROM course_assignments a WHERE a.course_id = c.id) AS students_count,
            (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = c.id) AS lessons_count
     FROM courses c
     WHERE c.id = $1`,
    [courseId]
  );

  const course = result.rows[0];
  if (!course) throw err(404, 'COURSE_NOT_FOUND');

  const learningItems = await query(
    'SELECT id, sort_order, text FROM course_learning_items WHERE course_id = $1 ORDER BY sort_order, id',
    [courseId]
  );
  const lessons = await query(
    'SELECT id, course_id, sort_order, title, duration, content, video_url FROM lessons WHERE course_id = $1 ORDER BY sort_order, id',
    [courseId]
  );

  const lessonsWithQuestions = await Promise.all(
    lessons.rows.map(async (lesson) => ({
      id: lesson.id,
      courseId: lesson.course_id,
      order: lesson.sort_order,
      title: lesson.title,
      duration: lesson.duration,
      content: lesson.content,
      videoUrl: lesson.video_url || null,
      questions: await listQuestionsForLessonPublic(lesson.id)
    }))
  );

  const normalizedLessons = lessonsWithQuestions.map((lesson) => ({
    ...lesson,
    questionsCount: Array.isArray(lesson.questions) ? lesson.questions.length : 0,
    hasTest: Array.isArray(lesson.questions) && lesson.questions.length > 0
  }));

  return {
    ...mapCourse(course),
    learningList: learningItems.rows.map((item) => item.text),
    lessons: normalizedLessons
  };
}

export async function createCourse(payload) {
  const title = requireNonEmptyString(payload.title, 'Title');
  const description = requireNonEmptyString(payload.description, 'Description');
  const category = requireNonEmptyString(payload.category, 'Category');
  const level = requireNonEmptyString(payload.level, 'Level');
  const courseId = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO courses (title, description, full_description, category, level, instructor, duration, image, audience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        title,
        description,
        payload.fullDescription?.trim() || description,
        category,
        level,
        payload.instructor?.trim() || 'Training Department Kerama Marazzi',
        normalizePositiveNumber(payload.duration, 'Duration', 0),
        payload.image || null,
        payload.audience || null
      ]
    );
    const course = result.rows[0];
    const learningList = Array.isArray(payload.learningList) ? payload.learningList : [];
    for (let index = 0; index < learningList.length; index += 1) {
      await client.query(
        'INSERT INTO course_learning_items (course_id, sort_order, text) VALUES ($1, $2, $3)',
        [course.id, index + 1, learningList[index]]
      );
    }
    return course.id;
  });

  return getCourseById(courseId);
}

export async function updateCourse(courseId, payload) {
  await getCourseById(courseId);

  const title = requireNonEmptyString(payload.title, 'Title');
  const description = requireNonEmptyString(payload.description, 'Description');
  const category = requireNonEmptyString(payload.category, 'Category');
  const level = requireNonEmptyString(payload.level, 'Level');

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE courses
       SET title = $2,
           description = $3,
           full_description = $4,
           category = $5,
           level = $6,
           instructor = $7,
           duration = $8,
           image = $9,
           audience = $10,
           updated_at = NOW()
       WHERE id = $1`,
      [
        courseId,
        title,
        description,
        payload.fullDescription?.trim() || description,
        category,
        level,
        payload.instructor?.trim() || null,
        normalizePositiveNumber(payload.duration, 'Duration', 0),
        payload.image || null,
        payload.audience || null
      ]
    );

    if (Array.isArray(payload.learningList)) {
      await client.query('DELETE FROM course_learning_items WHERE course_id = $1', [courseId]);
      for (let index = 0; index < payload.learningList.length; index += 1) {
        await client.query(
          'INSERT INTO course_learning_items (course_id, sort_order, text) VALUES ($1, $2, $3)',
          [courseId, index + 1, payload.learningList[index]]
        );
      }
    }
  });

  return getCourseById(courseId);
}

export async function deleteCourse(courseId) {
  const result = await query('DELETE FROM courses WHERE id = $1', [courseId]);
  if (!result.rowCount) {
    throw err(404, 'COURSE_NOT_FOUND');
  }
}

export async function createLesson(courseId, payload) {
  await getCourseById(courseId);
  const result = await query(
    `INSERT INTO lessons (course_id, sort_order, title, duration, content, video_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      courseId,
      normalizePositiveNumber(payload.order, 'Lesson order', 1),
      requireNonEmptyString(payload.title, 'Lesson title'),
      normalizePositiveNumber(payload.duration, 'Lesson duration', 0),
      requireNonEmptyString(payload.content, 'Lesson content'),
      normalizeOptionalText(payload.videoUrl)
    ]
  );
  return result.rows[0];
}

export async function updateLesson(lessonId, payload) {
  const result = await query(
    `UPDATE lessons
     SET sort_order = $2,
         title = $3,
         duration = $4,
         content = $5,
         video_url = $6,
         updated_at = NOW()
     WHERE id = $1`,
    [
      lessonId,
      normalizePositiveNumber(payload.order, 'Lesson order', 1),
      requireNonEmptyString(payload.title, 'Lesson title'),
      normalizePositiveNumber(payload.duration, 'Lesson duration', 0),
      requireNonEmptyString(payload.content, 'Lesson content'),
      normalizeOptionalText(payload.videoUrl)
    ]
  );
  if (!result.rowCount) {
    throw err(404, 'LESSON_NOT_FOUND');
  }
}

export async function deleteLesson(lessonId) {
  const result = await query('DELETE FROM lessons WHERE id = $1', [lessonId]);
  if (!result.rowCount) {
    throw err(404, 'LESSON_NOT_FOUND');
  }
}

export async function getLessonById(lessonId) {
  const result = await query('SELECT * FROM lessons WHERE id = $1', [lessonId]);
  const lesson = result.rows[0];
  if (!lesson) throw err(404, 'LESSON_NOT_FOUND');
  return lesson;
}

export function mapLessonForAdmin(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    order: row.sort_order,
    title: row.title,
    duration: row.duration,
    content: row.content,
    videoUrl: row.video_url || null
  };
}

export async function getLessonForAdmin(lessonId) {
  const lesson = await getLessonById(lessonId);
  return mapLessonForAdmin(lesson);
}
