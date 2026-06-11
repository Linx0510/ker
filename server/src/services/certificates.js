import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { query } from '../db/pool.js';
import { err } from '../utils/httpError.js';
import { findUserById } from './users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, '../../assets/fonts');
const BRAND_COLOR = '#0056b3';
const BRAND_LIGHT = '#e8f1fb';

function resolveFontFile(candidates) {
  for (const name of candidates) {
    const filePath = path.join(FONTS_DIR, name);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 10000) {
      return filePath;
    }
  }
  return null;
}

function getCertificateFonts() {
  const regular = resolveFontFile(['DejaVuSans.ttf', 'Arial.ttf', 'LiberationSans-Regular.ttf']);
  const bold = resolveFontFile(['DejaVuSans-Bold.ttf', 'Arial-Bold.ttf', 'LiberationSans-Bold.ttf']) || regular;
  if (!regular) {
    throw err(500, 'CERTIFICATE_FONT_MISSING');
  }
  return { regular, bold };
}

function formatRuDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

async function getCertificateAssignment(userId, assignmentId) {
  const result = await query(
    `SELECT a.id,
            a.user_id,
            a.course_id,
            a.assigned_at,
            c.title AS course_title,
            c.instructor,
            COUNT(DISTINCT l.id)::int AS lessons_count,
            COUNT(DISTINCT CASE WHEN p.completed THEN p.id END)::int AS completed_lessons,
            MAX(p.completed_at) AS completed_at
     FROM course_assignments a
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN lessons l ON l.course_id = c.id
     LEFT JOIN lesson_progress p
       ON p.lesson_id = l.id AND p.user_id = a.user_id AND p.completed = TRUE
     WHERE a.id = $1 AND a.user_id = $2
     GROUP BY a.id, c.id`,
    [assignmentId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    throw err(404, 'ASSIGNMENT_NOT_FOUND');
  }

  const lessonsCount = Number(row.lessons_count || 0);
  const completedLessons = Number(row.completed_lessons || 0);
  const progress = lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0;

  if (progress < 100) {
    throw err(400, 'CERTIFICATE_NOT_READY');
  }

  return {
    id: row.id,
    courseId: row.course_id,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at || new Date(),
    progress,
    course: {
      title: row.course_title,
      instructor: row.instructor
    }
  };
}

function drawFrame(doc, margin) {
  const { width, height } = doc.page;
  const inner = margin + 12;

  doc.save();
  doc.lineWidth(3).strokeColor(BRAND_COLOR).rect(margin, margin, width - margin * 2, height - margin * 2).stroke();
  doc.lineWidth(1).strokeColor(BRAND_COLOR).rect(inner, inner, width - inner * 2, height - inner * 2).stroke();
  doc.restore();
}

function renderCertificatePage(doc, fonts, data) {
  const margin = 48;
  drawFrame(doc, margin);

  doc.registerFont('cert-regular', fonts.regular);
  doc.registerFont('cert-bold', fonts.bold);

  const contentWidth = doc.page.width - margin * 2 - 48;
  const centerX = doc.page.width / 2;

  doc.fillColor(BRAND_COLOR).font('cert-bold').fontSize(28);
  doc.text('Kerama Marazzi', margin + 24, margin + 36, { width: contentWidth, align: 'center' });

  doc.fillColor('#333333').font('cert-bold').fontSize(22);
  doc.text('СЕРТИФИКАТ', margin + 24, margin + 88, { width: contentWidth, align: 'center' });

  doc.font('cert-regular').fontSize(13).fillColor('#555555');
  doc.text('о прохождении обучения', margin + 24, margin + 118, { width: contentWidth, align: 'center' });

  doc.moveTo(centerX - 120, margin + 150).lineTo(centerX + 120, margin + 150).lineWidth(1).strokeColor(BRAND_COLOR).stroke();

  doc.font('cert-regular').fontSize(12).fillColor('#444444');
  doc.text('Настоящим подтверждается, что', margin + 24, margin + 168, { width: contentWidth, align: 'center' });

  doc.font('cert-bold').fontSize(20).fillColor('#111111');
  doc.text(data.userName, margin + 24, margin + 192, { width: contentWidth, align: 'center' });

  if (data.userMeta) {
    doc.font('cert-regular').fontSize(11).fillColor('#666666');
    doc.text(data.userMeta, margin + 24, doc.y + 4, { width: contentWidth, align: 'center' });
  }

  doc.font('cert-regular').fontSize(12).fillColor('#444444');
  doc.text('успешно завершил(а) курс', margin + 24, doc.y + 18, { width: contentWidth, align: 'center' });

  doc.font('cert-bold').fontSize(16).fillColor(BRAND_COLOR);
  doc.text(data.courseTitle, margin + 24, doc.y + 10, { width: contentWidth, align: 'center' });

  const infoY = margin + 300;
  doc.roundedRect(margin + 60, infoY, contentWidth - 72, 72, 8).fill(BRAND_LIGHT);

  doc.fillColor('#333333').font('cert-regular').fontSize(11);
  doc.text(`Дата завершения: ${formatRuDate(data.completedAt)}`, margin + 80, infoY + 16, {
    width: contentWidth - 112
  });
  doc.text(`Прогресс: ${data.progress}%`, margin + 80, infoY + 36, { width: contentWidth - 112 });
  doc.text(`Номер сертификата: KM-${String(data.assignmentId).padStart(6, '0')}`, margin + 80, infoY + 56, {
    width: contentWidth - 112
  });

  if (data.instructor) {
    doc.font('cert-regular').fontSize(10).fillColor('#666666');
    doc.text(`Преподаватель: ${data.instructor}`, margin + 24, infoY + 90, { width: contentWidth, align: 'center' });
  }

  doc.font('cert-regular').fontSize(9).fillColor('#888888');
  doc.text(
    'Сертификат сформирован автоматически в системе обучения Kerama Marazzi LMS.',
    margin + 24,
    doc.page.height - margin - 36,
    { width: contentWidth, align: 'center' }
  );
}

export async function buildCertificatePdf(userId, assignmentId) {
  const user = await findUserById(userId);
  if (!user) throw err(404, 'USER_NOT_FOUND');

  const assignment = await getCertificateAssignment(userId, Number(assignmentId));
  const fonts = getCertificateFonts();

  const userMeta = [user.position_name || user.position, user.department_name || user.department]
    .filter(Boolean)
    .join(' · ');

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0
  });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  renderCertificatePage(doc, fonts, {
    userName: user.name,
    userMeta,
    courseTitle: assignment.course.title,
    instructor: assignment.course.instructor,
    completedAt: assignment.completedAt,
    progress: assignment.progress,
    assignmentId: assignment.id
  });

  doc.end();
  const pdf = await finished;
  const filename = buildCertificateFilename(assignment.id, assignment.course.title);
  return { pdf, filename };
}

export function buildCertificateFilename(assignmentId, courseTitle) {
  const safeTitle = String(courseTitle || 'course')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'course';
  return {
    utf8: `sertifikat-${safeTitle}-${assignmentId}.pdf`,
    ascii: `sertifikat-${assignmentId}.pdf`
  };
}

export function buildContentDisposition(names) {
  const encoded = encodeURIComponent(names.utf8);
  return `attachment; filename="${names.ascii}"; filename*=UTF-8''${encoded}`;
}
