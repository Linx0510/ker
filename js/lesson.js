class LessonPage {
  constructor() {
    this.currentCourse = null;
    this.courseProgress = { lessons: [] };
    this.currentLessonId = null;
  }

  buildMatchingUI(question, index) {
    const rightItems = [...(question.matchingPairs || [])].map((item) => item.right);
    const shuffled = rightItems.sort(() => Math.random() - 0.5);
    return `
      <div class="matching-question" data-question-id="${question.id}">
        <div class="matching-grid">
          <div class="matching-column">
            ${(question.matchingPairs || []).map((pair) => `<div class="matching-item">${utils.escapeHtml(pair.left)}</div>`).join('')}
          </div>
          <div class="matching-column matching-right-list" id="matching-right-${question.id}">
            ${shuffled.map((right) => `<div class="matching-item matching-draggable" data-right-value="${utils.escapeHtml(right)}">${utils.escapeHtml(right)}</div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  normalizeOptions(options) {
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
      try {
        const parsed = JSON.parse(options);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        return [];
      }
    }
    return [];
  }

  getLessonTestState({ questions, lessonProgress }) {
    if (!Array.isArray(questions) || !questions.length) return 'missing';
    if (lessonProgress?.completed) return 'passed';
    return 'available';
  }

  async init() {
    if (!window.location.pathname.endsWith('lesson.html')) return;

    const params = new URLSearchParams(window.location.search);
    const courseId = Number(params.get('courseId'));
    const lessonId = Number(params.get('lessonId'));
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) {
      window.location.href = 'courses.html';
      return;
    }

    this.currentLessonId = lessonId;
    try {
      await this.loadLesson(courseId, lessonId);
    } catch (error) {
      utils.showToast(i18n.formatError(error) || i18n.t.loadError, 'error');
    }
  }

  extractYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
      /^([\w-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  renderVideoEmbed(url) {
    if (!url) return '';
    const trimmed = url.trim();
    const youtubeId = this.extractYouTubeId(trimmed);
    if (youtubeId) {
      const origin = encodeURIComponent(window.location.origin);
      const embedSrc = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&origin=${origin}`;
      const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      return `<div class="lesson-video"><div class="lesson-video-player"><iframe src="${embedSrc}" title="Видео урока" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div><p class="lesson-video-fallback"><a href="${watchUrl}" target="_blank" rel="noopener noreferrer">Открыть видео на YouTube</a></p></div>`;
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) {
      return `<div class="lesson-video"><video controls src="${utils.escapeHtml(trimmed)}"></video></div>`;
    }
    return `<div class="lesson-video"><a href="${utils.escapeHtml(trimmed)}" class="btn btn-outline" target="_blank" rel="noopener">Открыть видео</a></div>`;
  }

  async loadLesson(courseId, lessonId) {
    const user = await auth.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    let progress;
    try {
      progress = await api.get(`/courses/${courseId}/progress`);
    } catch (error) {
      if (error.status === 401) {
        api.setAccessToken(null);
        auth.currentUser = null;
        window.location.href = 'login.html';
        return;
      }
      if (error.status === 403 || error.code === 'COURSE_NOT_ASSIGNED') {
        utils.showToast(i18n.t.notAssigned, 'error');
        window.location.href = 'courses.html';
        return;
      }
      throw error;
    }

    const { course } = await api.get(`/courses/${courseId}`);
    this.currentCourse = course;
    this.courseProgress = progress;

    const lesson = course.lessons.find((item) => Number(item.id) === Number(lessonId));
    if (!lesson) {
      window.location.href = `course-detail.html?id=${courseId}`;
      return;
    }

    const lessonProgress = progress.lessons.find((item) => Number(item.lessonId) === Number(lessonId));
    const orderedLessons = [...course.lessons].sort((a, b) => a.order - b.order);
    const currentIndex = orderedLessons.findIndex((item) => Number(item.id) === Number(lessonId));
    const prevLesson = orderedLessons[currentIndex - 1];
    const nextLesson = orderedLessons[currentIndex + 1];

    document.title = `${lesson.title} — ${course.title}`;
    const titleEl = document.getElementById('lesson-title');
    const courseLink = document.getElementById('lesson-course-link');
    if (titleEl) titleEl.textContent = `${lesson.order}. ${lesson.title}`;
    if (courseLink) {
      courseLink.href = `course-detail.html?id=${courseId}`;
      courseLink.textContent = course.title;
    }

    const container = document.getElementById('lesson-content');
    if (!container) return;

    const questions = (lesson.questions || []).map((q, index) => ({
      ...q,
      id: q.id ?? index,
      options: this.normalizeOptions(q.options)
    }));

    const testState = this.getLessonTestState({ questions, lessonProgress });
    const testFormMarkup = `<form id="lesson-test-form" class="test-questions">
        ${questions.map((q, index) => `
          <div class="test-question">
            <p>${index + 1}. ${utils.escapeHtml(q.question)}</p>
            <div class="test-options">
              ${q.type === 'matching'
                ? this.buildMatchingUI(q, index)
                : q.type === 'multiple'
                  ? q.options.map((option, optionIndex) => `
                    <label>
                      <input type="checkbox" name="question-${q.id}" value="${optionIndex}">
                      ${utils.escapeHtml(option)}
                    </label>
                  `).join('')
                  : q.options.map((option, optionIndex) => `
                    <label>
                      <input type="radio" name="question-${q.id}" value="${optionIndex}" required>
                      ${utils.escapeHtml(option)}
                    </label>
                  `).join('')}
            </div>
          </div>
        `).join('')}
        <button type="submit" class="btn btn-primary">${i18n.t.submitTest}</button>
      </form>`;
    const testBlock = testState === 'missing'
      ? `<div class="test-result"><p>${i18n.t.lessonTestMissing}</p><button type="button" class="btn btn-primary" id="complete-lesson-btn">${i18n.t.completeLesson}</button></div>`
      : testState === 'passed'
        ? `<div class="test-result">
            <p>${i18n.t.testPassed}: ${lessonProgress.score}%</p>
            <p>${i18n.t.lessonTestPassedState}</p>
            <button type="button" class="btn btn-outline" id="retake-lesson-test-btn">${i18n.t.retakeTest}</button>
          </div>`
        : `<div class="test-result"><p>${i18n.t.lessonTestAvailableState}</p></div>${testFormMarkup}`;

    container.innerHTML = `
      <div class="lesson-detail">
        <div class="lesson-meta-row">
          <span><i class="fas fa-clock"></i> ${lesson.duration} мин</span>
          ${lessonProgress?.completed ? `<span class="completed-badge">${i18n.t.completed}</span>` : ''}
        </div>
        ${this.renderVideoEmbed(lesson.videoUrl)}
        <div class="lesson-text">${utils.escapeHtml(lesson.content).replace(/\n/g, '<br>')}</div>
        <div class="lesson-test">
          <h4>${i18n.t.lessonTest}</h4>
          ${testBlock}
        </div>
      </div>
    `;

    const nav = document.getElementById('lesson-nav');
    if (nav) {
      nav.innerHTML = `
        ${prevLesson ? `<a href="lesson.html?courseId=${courseId}&lessonId=${prevLesson.id}" class="btn btn-outline">${i18n.t.prevLesson}</a>` : '<span></span>'}
        ${nextLesson ? `<a href="lesson.html?courseId=${courseId}&lessonId=${nextLesson.id}" class="btn btn-primary">${i18n.t.nextLesson}</a>` : '<span></span>'}
      `;
    }

    document.getElementById('complete-lesson-btn')?.addEventListener('click', () => this.submitLesson(lessonId, []));
    document.getElementById('retake-lesson-test-btn')?.addEventListener('click', () => {
      const confirmed = window.confirm(i18n.t.retakeConfirm);
      if (confirmed) {
        this.renderRetakeForm(questions, lessonId);
      }
    });
    const testForm = document.getElementById('lesson-test-form');
    if (testForm) {
      questions.filter((question) => question.type === 'matching').forEach((question) => {
        const list = document.getElementById(`matching-right-${question.id}`);
        if (list && window.Sortable) {
          new window.Sortable(list, {
            animation: 120
          });
        }
      });
      testForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const answers = questions.map((q) => {
          if (q.type === 'multiple') {
            const selectedIndices = Array.from(testForm.querySelectorAll(`input[name="question-${q.id}"]:checked`))
              .map((input) => Number(input.value));
            return {
              questionId: q.id,
              selectedIndices
            };
          }
          if (q.type === 'matching') {
            const rightNodes = Array.from(document.querySelectorAll(`#matching-right-${q.id} .matching-item`));
            const matchingPairs = rightNodes.map((node, pairIndex) => ({
              left: q.matchingPairs[pairIndex]?.left,
              right: node.dataset.rightValue || node.textContent
            }));
            return {
              questionId: q.id,
              matchingPairs
            };
          }
          return {
            questionId: q.id,
            selectedIndex: Number(testForm.querySelector(`input[name="question-${q.id}"]:checked`)?.value)
          };
        });
        await this.submitLesson(lessonId, answers);
      });
    }
  }

  renderRetakeForm(questions, lessonId) {
    const testWrapper = document.querySelector('.lesson-test');
    if (!testWrapper) return;
    const testFormMarkup = `<form id="lesson-test-form" class="test-questions">
      <p>${i18n.t.retakeStarted}</p>
      ${questions.map((q, index) => `
        <div class="test-question">
          <p>${index + 1}. ${utils.escapeHtml(q.question)}</p>
          <div class="test-options">
            ${q.type === 'matching'
              ? this.buildMatchingUI(q, index)
              : q.type === 'multiple'
                ? q.options.map((option, optionIndex) => `
                  <label>
                    <input type="checkbox" name="question-${q.id}" value="${optionIndex}">
                    ${utils.escapeHtml(option)}
                  </label>
                `).join('')
                : q.options.map((option, optionIndex) => `
                  <label>
                    <input type="radio" name="question-${q.id}" value="${optionIndex}" required>
                    ${utils.escapeHtml(option)}
                  </label>
                `).join('')}
          </div>
        </div>
      `).join('')}
      <button type="submit" class="btn btn-primary">${i18n.t.submitTest}</button>
    </form>`;
    testWrapper.innerHTML = `<h4>${i18n.t.lessonTest}</h4>${testFormMarkup}`;
    const testForm = document.getElementById('lesson-test-form');
    if (!testForm) return;
    questions.filter((question) => question.type === 'matching').forEach((question) => {
      const list = document.getElementById(`matching-right-${question.id}`);
      if (list && window.Sortable) {
        new window.Sortable(list, { animation: 120 });
      }
    });
    testForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const answers = questions.map((q) => {
        if (q.type === 'multiple') {
          const selectedIndices = Array.from(testForm.querySelectorAll(`input[name="question-${q.id}"]:checked`))
            .map((input) => Number(input.value));
          return { questionId: q.id, selectedIndices };
        }
        if (q.type === 'matching') {
          const rightNodes = Array.from(document.querySelectorAll(`#matching-right-${q.id} .matching-item`));
          const matchingPairs = rightNodes.map((node, pairIndex) => ({
            left: q.matchingPairs[pairIndex]?.left,
            right: node.dataset.rightValue || node.textContent
          }));
          return { questionId: q.id, matchingPairs };
        }
        return {
          questionId: q.id,
          selectedIndex: Number(testForm.querySelector(`input[name="question-${q.id}"]:checked`)?.value)
        };
      });
      await this.submitLesson(lessonId, answers);
    });
  }

  async submitLesson(lessonId, answers) {
    const courseId = this.currentCourse.id;
    try {
      const result = await api.post(`/courses/lessons/${lessonId}/complete`, { answers });
      if (result.wasRetake) {
        utils.showToast(i18n.t.testRetakeSaved, 'success');
      } else {
        utils.showToast(i18n.t.testPassed, 'success');
      }

      const orderedLessons = [...this.currentCourse.lessons].sort((a, b) => a.order - b.order);
      const currentIndex = orderedLessons.findIndex((item) => Number(item.id) === Number(lessonId));
      const nextLesson = orderedLessons[currentIndex + 1];
      if (nextLesson) {
        window.location.href = `lesson.html?courseId=${courseId}&lessonId=${nextLesson.id}`;
        return;
      }
      window.location.href = `course-detail.html?id=${courseId}`;
    } catch (error) {
      utils.showToast(i18n.formatError(error) || i18n.t.testFailed, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new LessonPage().init());
