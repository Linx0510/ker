import { pool, query } from '../db/pool.js';
import { env } from '../config/env.js';
import { createUser, findUserByEmail } from '../services/users.js';
import { createCourse, createLesson } from '../services/courses.js';
import { assignCourse } from '../services/assignments.js';
import { completeLesson } from '../services/progress.js';
import { createQuestion } from '../services/lessonQuestions.js';

async function ensureUser(payload) {
  const existing = await findUserByEmail(payload.email);
  if (existing) return existing;
  return createUser(payload);
}

async function main() {
  const admin = await ensureUser({
    name: env.adminName,
    email: env.adminEmail,
    password: env.adminPassword,
    role: 'admin',
    status: 'active',
    company: 'Kerama Marazzi',
    position: 'Training Administrator',
    department: 'Training'
  });

  const sales = await ensureUser({
    name: 'Sales Manager',
    email: 'sales@kerama-marazzi.ru',
    password: 'sales123',
    role: 'user',
    status: 'active',
    company: 'Kerama Marazzi',
    position: 'Sales Manager',
    department: 'Sales'
  });

  await ensureUser({
    name: 'Product Consultant',
    email: 'consultant@kerama-marazzi.ru',
    password: 'consult123',
    role: 'user',
    status: 'active',
    company: 'Kerama Marazzi',
    position: 'Consultant',
    department: 'Showroom'
  });

  const existingCourses = await query('SELECT id FROM courses LIMIT 1');
  if (existingCourses.rows.length === 0) {
    const course = await createCourse({
      title: 'Basics of Ceramic Tile',
      description: 'Introductory course on ceramic tile collections and selection.',
      fullDescription: 'Introductory course on Kerama Marazzi ceramic tiles, assortment, positioning, and customer guidance.',
      category: 'plita',
      level: 'beginner',
      instructor: 'Training Department Kerama Marazzi',
      duration: 8,
      audience: 'Sales staff and consultants',
      learningList: [
        'Understand tile assortment',
        'Explain differences between collections',
        'Guide customers by use case'
      ]
    });

    const lesson1 = await createLesson(course.id, { order: 1, title: 'Tile Assortment', duration: 10, content: 'Overview of tile assortment.' });
    await createLesson(course.id, { order: 2, title: 'Collection Positioning', duration: 12, content: 'How to position collections.' });
    await createLesson(course.id, { order: 3, title: 'Customer Consultation', duration: 15, content: 'Consultation basics.' });

    const question = await createQuestion(lesson1.id, {
      type: 'single',
      order: 1,
      question: 'What is the main purpose of the introductory tile course?',
      options: ['Understand assortment', 'Install plumbing', 'Design websites', 'Manage payroll'],
      correctIndex: 0
    });

    await assignCourse(sales.id, course.id);
    await completeLesson(sales.id, lesson1.id, {
      answers: [{ questionId: question.id, selectedIndex: 0 }]
    });
  }

  console.log(`Seed complete. Admin: ${admin.email}`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
