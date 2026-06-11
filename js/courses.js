class CoursesPage {
  constructor() {
    this.currentCourse = null;
    this.courseProgress = { isEnrolled: false, percent: 0, lessons: [] };
  }

  async init() {
    const path = window.location.pathname;
    try {
      if (path.endsWith('courses.html')) {
        await this.initCoursesPage();
      }
      if (path.endsWith('course-detail.html')) {
        await this.initCourseDetailPage();
      }
    } catch (error) {
      utils.showToast(error.message || i18n.t.loadError, 'error');
    }
  }

  async initCoursesPage() {
    await this.loadCourses();
    const searchInput = document.getElementById('course-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.loadCourses());
    }
  }

  async loadCourses() {
    const container = document.getElementById('courses-container');
    if (!container) return;

    container.innerHTML = `<div class="loading">${i18n.t.loadingCourses}</div>`;
    try {
      const search = document.getElementById('course-search')?.value?.trim() || '';
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const data = await api.get(`/users/me/courses${params.toString() ? `?${params.toString()}` : ''}`);
      if (!data.items.length) {
        container.innerHTML = `<div class="empty-message">${i18n.t.noCourses}</div>`;
        return;
      }

      container.innerHTML = data.items.map((course) => `
        <div class="course-card-wrap">
          <article class="course-card course-card--compact">
            <div class="course-content">
            <h3>${utils.escapeHtml(course.title)}</h3>
            <p class="course-description">${utils.escapeHtml(course.description)}</p>
            <div class="course-meta">
              <span>${i18n.t.progressLabel}: ${course.progressPercent || 0}%</span>
              <span><i class="fas fa-layer-group"></i> ${course.lessonsCount} уроков</span>
              ${course.hasTests ? `<span class="lesson-test-badge">${i18n.t.testRequiredBadge}</span>` : ''}
            </div>
            <div class="course-actions">
              <a href="course-detail.html?id=${course.id}" class="btn btn-primary">${i18n.t.details}</a>
            </div>
            </div>
          </article>
        </div>
      `).join('');
    } catch (error) {
      utils.showErrorBanner(container, i18n.formatError(error) || i18n.t.loadError);
    }
  }

  async initCourseDetailPage() {
    const courseId = Number(new URLSearchParams(window.location.search).get('id'));
    if (!courseId) {
      window.location.href = 'courses.html';
      return;
    }
    await this.loadCourseDetail(courseId);
  }

  async loadCourseDetail(courseId) {
    const user = await auth.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    let progress;
    try {
      progress = await api.get(`/courses/${courseId}/progress`);
    } catch (error) {
      if (error.status === 403 || error.code === 'COURSE_NOT_ASSIGNED') {
        utils.showToast(i18n.t.notAssigned, 'error');
        window.location.href = 'courses.html';
        return;
      }
      throw error;
    }

    const data = await api.get(`/courses/${courseId}`);
    this.currentCourse = data.course;
    this.courseProgress = progress;

    document.getElementById('course-title').textContent = data.course.title;
    document.getElementById('course-description').textContent = data.course.description;
    document.getElementById('course-full-description').textContent = data.course.fullDescription || data.course.description;
    document.getElementById('course-duration').textContent = `${data.course.duration} ч`;
    document.getElementById('course-lessons-count').textContent = `${data.course.lessons.length} уроков`;
    document.getElementById('course-progress-bar').style.width = `${progress.percent || 0}%`;
    document.getElementById('course-progress-percent').textContent = `${progress.percent || 0}%`;

    const learningList = document.getElementById('course-learning-list');
    if (learningList) {
      learningList.innerHTML = (data.course.learningList || [])
        .map((item) => `<li>${utils.escapeHtml(item)}</li>`)
        .join('');
    }

    const audience = document.getElementById('course-audience');
    if (audience) audience.textContent = data.course.audience || '—';

    const lessonsList = document.getElementById('lessons-list');
    if (lessonsList) {
      lessonsList.innerHTML = data.course.lessons.map((lesson) => {
        const lessonProgress = progress.lessons.find((item) => item.lessonId === lesson.id);
        return `
          <a href="lesson.html?courseId=${courseId}&lessonId=${lesson.id}" class="lesson-item ${lessonProgress?.completed ? 'completed' : ''}">
            <div>
              <div class="lesson-title">${lesson.order}. ${utils.escapeHtml(lesson.title)}</div>
              ${lesson.hasTest ? `<div class="lesson-test-required">${i18n.t.testRequiredBadge}</div>` : ''}
            </div>
            <div class="lesson-status">${lessonProgress?.completed ? i18n.t.completed : `${lesson.duration} мин`}</div>
          </a>
        `;
      }).join('');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new CoursesPage().init());
