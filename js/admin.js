class AdminPage {
  async init() {
    if (!window.location.pathname.endsWith('admin.html')) return;
    const user = await auth.getCurrentUser();
    if (!user || user.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }
    this.departments = [];
    this.lessons = [];
    this.courses = [];
    this.currentQuestions = [];
    this.activeDraftId = null;
    this.questionSortInstance = null;
    this.aiPollTimer = null;
    this.aiPollDelayMs = 2000;
    this.aiPollMaxDelayMs = 15000;
    this.aiPollConsecutive429 = 0;
    this.aiPollRequestInFlight = false;

    this.ensureLessonModal();
    this.ensureQuestionModal();
    this.bindTabs();
    this.bindActions();
    await this.loadAll();
  }

  handleError(error) {
    utils.showToast(i18n.formatError(error) || i18n.t.loadError, 'error');
  }

  bindTabs() {
    const buttons = document.querySelectorAll('.admin-tab-btn');
    const contents = document.querySelectorAll('.admin-tab-content');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((item) => item.classList.remove('active'));
        contents.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        const tab = document.getElementById(`${button.dataset.tab}-tab`);
        if (tab) tab.classList.add('active');
      });
    });
  }

  bindActions() {
    document.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', () => this.closeModals()));
    document.getElementById('add-user-btn')?.addEventListener('click', async () => {
      await this.populateDepartmentSelect('new-user-department', 'new-user-position');
      document.getElementById('add-user-modal').classList.add('active');
    });
    document.getElementById('add-course-btn')?.addEventListener('click', () => this.openCourseModal());
    document.getElementById('add-lesson-btn')?.addEventListener('click', () => this.openLessonModal());
    document.getElementById('add-question-btn')?.addEventListener('click', () => this.openQuestionModal());
    document.getElementById('assign-course-btn')?.addEventListener('click', () => this.openAssignModal());
    document.getElementById('add-department-btn')?.addEventListener('click', () => this.openDepartmentModal());
    document.getElementById('add-position-btn')?.addEventListener('click', () => this.openPositionModal());
    document.getElementById('questions-lesson-filter')?.addEventListener('change', (event) => {
      const lessonId = Number(event.target.value);
      if (Number.isFinite(lessonId) && lessonId > 0) this.loadQuestionsForLesson(lessonId);
    });
    document.getElementById('ai-generation-type')?.addEventListener('change', () => this.renderAIDynamicFields());
    document.getElementById('ai-generate-form')?.addEventListener('submit', (event) => this.submitAIGeneration(event));
    document.getElementById('ai-refresh-draft-btn')?.addEventListener('click', () => this.refreshActiveDraft());
    document.getElementById('ai-confirm-save-btn')?.addEventListener('click', () => this.confirmAIDraft());

    this.bindCrudForms();
  }

  bindCrudForms() {
    document.getElementById('department-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const form = event.target;
        const name = document.getElementById('department-name').value.trim();
        if (form.dataset.mode === 'edit') await api.patch(`/admin/departments/${form.dataset.id}`, { name });
        else await api.post('/admin/departments', { name });
        this.closeModals();
        await this.loadAll();
      });
    });

    document.getElementById('position-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const form = event.target;
        const name = document.getElementById('position-name').value.trim();
        if (form.dataset.mode === 'edit') await api.patch(`/admin/positions/${form.dataset.id}`, { name });
        else await api.post(`/admin/departments/${document.getElementById('position-department').value}/positions`, { name });
        this.closeModals();
        await this.loadAll();
      });
    });

    document.getElementById('add-user-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const deptSelect = document.getElementById('new-user-department');
        const posSelect = document.getElementById('new-user-position');
        const validationError = utils.validateDeptPositionSelection(deptSelect, posSelect);
        if (validationError) throw new Error(validationError);
        await api.post('/admin/users', {
          name: document.getElementById('new-user-name').value.trim(),
          email: document.getElementById('new-user-email').value.trim(),
          password: document.getElementById('new-user-password').value.trim(),
          role: document.getElementById('new-user-role').value,
          ...utils.buildDeptPositionPayload(deptSelect, posSelect)
        });
        this.closeModals();
        event.target.reset();
        await this.loadAll();
      }).catch((error) => this.handleError(error));
    });

    document.getElementById('add-course-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const form = event.target;
        const payload = {
          title: document.getElementById('new-course-title').value.trim(),
          description: document.getElementById('new-course-description').value.trim(),
          fullDescription: document.getElementById('new-course-full-description').value.trim(),
          category: document.getElementById('new-course-category').value,
          level: document.getElementById('new-course-level').value,
          instructor: document.getElementById('new-course-instructor').value.trim(),
          duration: Number(document.getElementById('new-course-duration').value),
          audience: 'Сотрудники Kerama Marazzi',
          learningList: []
        };
        if (form.dataset.mode === 'edit' && form.dataset.courseId) await api.patch(`/admin/courses/${form.dataset.courseId}`, payload);
        else await api.post('/admin/courses', payload);
        this.closeModals();
        this.resetCourseForm();
        await this.loadAll();
      }).catch((error) => this.handleError(error));
    });

    document.getElementById('assign-course-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        await api.post('/admin/assignments', {
          userId: Number(document.getElementById('assign-user').value),
          courseId: Number(document.getElementById('assign-course').value)
        });
        this.closeModals();
        await this.loadAll();
      }).catch((error) => this.handleError(error));
    });

    document.getElementById('lesson-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const form = event.target;
        const courseId = Number(document.getElementById('lesson-course-id').value);
        const payload = {
          order: Number(document.getElementById('lesson-order').value),
          title: document.getElementById('lesson-title').value.trim(),
          content: document.getElementById('lesson-content').value.trim(),
          duration: Number(document.getElementById('lesson-duration').value),
          videoUrl: document.getElementById('lesson-video-url')?.value.trim() || null
        };
        if (form.dataset.mode === 'edit' && form.dataset.lessonId) await api.patch(`/admin/lessons/${form.dataset.lessonId}`, payload);
        else await api.post(`/admin/courses/${courseId}/lessons`, payload);
        this.closeModals();
        this.resetLessonForm();
        await this.loadAll();
      }).catch((error) => this.handleError(error));
    });

    document.getElementById('question-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        const payload = this.buildQuestionPayloadFromForm();
        const form = event.target;
        if (form.dataset.mode === 'edit' && form.dataset.questionId) {
          await api.patch(`/admin/questions/${form.dataset.questionId}`, payload);
        } else {
          await api.post(`/admin/lessons/${payload.lessonId}/questions`, payload);
        }
        this.closeModals();
        await this.loadQuestionsForLesson(payload.lessonId);
        await this.loadAll();
      }).catch((error) => this.handleError(error));
    });
  }

  ensureLessonModal() {
    if (document.getElementById('lesson-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'lesson-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${i18n.t.addLesson}</h3>
          <button class="close-modal" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <form id="lesson-form">
            <div class="form-group"><label for="lesson-course-id">Курс *</label><select id="lesson-course-id" required></select></div>
            <div class="form-group"><label for="lesson-title">Название урока *</label><input type="text" id="lesson-title" required></div>
            <div class="form-group"><label for="lesson-order">Порядок *</label><input type="number" id="lesson-order" min="1" value="1" required></div>
            <div class="form-group"><label for="lesson-duration">Длительность *</label><input type="number" id="lesson-duration" min="0" value="10" required></div>
            <div class="form-group"><label for="lesson-video-url">${i18n.t.videoUrl}</label><input type="url" id="lesson-video-url" placeholder="https://"></div>
            <div class="form-group"><label for="lesson-content">Текст урока *</label><textarea id="lesson-content" rows="5" required></textarea></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline close-modal">${i18n.t.cancel}</button>
              <button type="submit" class="btn btn-primary">${i18n.t.saveLesson}</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  ensureQuestionModal() {
    if (document.getElementById('question-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'question-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="question-modal-title">Добавить вопрос</h3>
          <button class="close-modal" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <form id="question-form" data-mode="create">
            <div class="form-group"><label for="question-lesson-id">Урок *</label><select id="question-lesson-id" required></select></div>
            <div class="form-group"><label for="question-order">Порядок *</label><input id="question-order" type="number" min="1" value="1" required></div>
            <div class="form-group"><label for="question-type">Тип *</label>
              <select id="question-type">
                <option value="single">Один правильный ответ</option>
                <option value="multiple">Несколько правильных ответов</option>
                <option value="matching">Matching</option>
              </select>
            </div>
            <div class="form-group"><label for="question-text">Вопрос *</label><textarea id="question-text" rows="3" required></textarea></div>
            <div class="form-group" id="question-options-group"><label for="question-options">Варианты (каждый с новой строки)</label><textarea id="question-options" rows="4"></textarea></div>
            <div class="form-group" id="question-correct-index-group"><label for="question-correct-index">Индекс правильного ответа</label><input id="question-correct-index" type="number" min="0" value="0"></div>
            <div class="form-group" id="question-correct-indices-group" style="display:none;"><label for="question-correct-indices">Индексы правильных ответов (через запятую)</label><input id="question-correct-indices" type="text" placeholder="0,2"></div>
            <div class="form-group" id="question-matching-group" style="display:none;"><label for="question-matching-pairs">Пары matching (левое => правое)</label><textarea id="question-matching-pairs" rows="4"></textarea></div>
            <div class="form-group"><label for="question-explanation">Объяснение</label><textarea id="question-explanation" rows="3"></textarea></div>
            <div class="form-group"><label for="question-points">Баллы</label><input id="question-points" type="number" min="1" value="1"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline close-modal">${i18n.t.cancel}</button>
              <button type="submit" class="btn btn-primary">Сохранить вопрос</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('question-type')?.addEventListener('change', () => this.toggleQuestionTypeFields());
    document.querySelectorAll('#question-modal .close-modal').forEach((button) => button.addEventListener('click', () => this.closeModals()));
  }

  toggleQuestionTypeFields() {
    const type = document.getElementById('question-type').value;
    const single = document.getElementById('question-correct-index-group');
    const multiple = document.getElementById('question-correct-indices-group');
    const matching = document.getElementById('question-matching-group');
    const options = document.getElementById('question-options-group');
    single.style.display = type === 'single' ? 'block' : 'none';
    multiple.style.display = type === 'multiple' ? 'block' : 'none';
    matching.style.display = type === 'matching' ? 'block' : 'none';
    options.style.display = type === 'matching' ? 'none' : 'block';
  }

  async populateDepartmentSelect(deptId, posId, selectedDept = '', selectedPos = '') {
    const deptSelect = document.getElementById(deptId);
    const posSelect = document.getElementById(posId);
    if (!deptSelect || !posSelect) return;
    await utils.setupDepartmentPositionCascade({
      deptSelectEl: deptSelect,
      posSelectEl: posSelect,
      loadDepartments: async () => this.departments,
      loadPositions: async (departmentId) => (await api.get(`/admin/departments/${departmentId}/positions`)).items || [],
      selectedDeptId: selectedDept,
      selectedPosId: selectedPos
    });
  }

  async loadAll() {
    const [users, courses, assignments, lessons, departments] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/courses'),
      api.get('/admin/assignments'),
      api.get('/admin/lessons'),
      api.get('/admin/departments')
    ]);
    this.departments = departments.items || [];
    this.lessons = lessons.items || [];
    this.courses = courses.items || [];
    this.renderUsers(users.items || [], assignments.items || []);
    this.renderCourses(this.courses);
    this.renderLessons(this.lessons);
    this.renderAssignments(assignments.items || []);
    this.renderDirectories();
    this.renderQuestionLessonFilter(this.lessons);
    this.renderAIDynamicFields();
  }

  renderQuestionLessonFilter(lessons) {
    const filter = document.getElementById('questions-lesson-filter');
    const lessonSelect = document.getElementById('question-lesson-id');
    const options = ['<option value="">Выберите урок</option>'].concat(
      lessons.map((lesson) => `<option value="${lesson.id}">${utils.escapeHtml(`${lesson.courseTitle} / ${lesson.title}`)}</option>`)
    ).join('');
    if (filter) filter.innerHTML = options;
    if (lessonSelect) lessonSelect.innerHTML = options;
  }

  renderUsers(users, assignments) {
    const body = document.getElementById('users-table-body');
    const assignmentsByUser = assignments.reduce((acc, item) => {
      if (!acc[item.userId]) acc[item.userId] = [];
      acc[item.userId].push(item.courseTitle);
      return acc;
    }, {});
    body.innerHTML = users.map((user) => `
      <tr>
        <td>${user.id}</td><td>${utils.escapeHtml(user.name)}</td><td>${utils.escapeHtml(user.email)}</td>
        <td>${utils.escapeHtml(user.position || '—')}</td><td>${utils.escapeHtml(user.department || '—')}</td>
        <td>${utils.escapeHtml(user.role)} / ${i18n.status(user.status || 'active')}</td>
        <td>${utils.escapeHtml((assignmentsByUser[user.id] || []).join(', ') || '—')}</td>
        <td>${user.status === 'pending' ? `<button class="btn btn-small" onclick="adminPage.approveUser(${user.id})">Подтвердить</button>` : ''}${user.role !== 'admin' ? `<button class="btn btn-small" onclick="adminPage.deleteUser(${user.id})">Удалить</button>` : ''}</td>
      </tr>`).join('');
  }

  renderCourses(courses) {
    const body = document.getElementById('courses-table-body');
    body.innerHTML = courses.map((course) => `
      <tr>
        <td>${course.id}</td><td>${utils.escapeHtml(course.title)}</td><td>${utils.escapeHtml(i18n.category(course.category))}</td>
        <td>${utils.escapeHtml(i18n.level(course.level))}</td><td>${course.lessonsCount}</td><td>${course.studentsCount}</td>
        <td><button class="btn btn-small" onclick="adminPage.editCourse(${course.id})">Изменить</button><button class="btn btn-small" onclick="adminPage.deleteCourse(${course.id})">Удалить</button></td>
      </tr>`).join('');
  }

  renderLessons(lessons) {
    const body = document.getElementById('lessons-table-body');
    body.innerHTML = lessons.map((lesson) => `
      <tr>
        <td>${lesson.id}</td><td>${utils.escapeHtml(lesson.title)}</td><td>${utils.escapeHtml(lesson.courseTitle)}</td>
        <td>${lesson.order}</td><td>${lesson.duration}</td><td>${lesson.questionsCount || 0}</td>
        <td><button class="btn btn-small" onclick="adminPage.editLesson(${lesson.id})">Изменить</button><button class="btn btn-small" onclick="adminPage.deleteLesson(${lesson.id})">Удалить</button></td>
      </tr>`).join('');
  }

  renderAssignments(assignments) {
    const body = document.getElementById('assignments-table-body');
    body.innerHTML = assignments.map((assignment) => `
      <tr>
        <td>${assignment.id}</td><td>${utils.escapeHtml(assignment.userName)}</td><td>${utils.escapeHtml(assignment.courseTitle)}</td>
        <td>${new Date(assignment.assignedAt).toLocaleDateString('ru-RU')}</td><td>${assignment.progress}%</td>
        <td>${assignment.progress === 100 ? 'Завершён' : 'В процессе'}</td>
        <td><button class="btn btn-small" onclick="adminPage.deleteAssignment(${assignment.id})">Удалить</button></td>
      </tr>`).join('');
  }

  renderDirectories() {
    const deptBody = document.getElementById('departments-table-body');
    const deptFilter = document.getElementById('directory-department-filter');
    if (deptFilter) {
      deptFilter.innerHTML = '<option value="">Все отделы</option>' + this.departments.map((item) => `<option value="${item.id}">${utils.escapeHtml(item.name)}</option>`).join('');
      if (!deptFilter.dataset.bound) {
        deptFilter.dataset.bound = 'true';
        deptFilter.addEventListener('change', () => this.renderPositionsTable(deptFilter.value));
      }
    }
    deptBody.innerHTML = this.departments.map((dept) => `
      <tr>
        <td>${dept.id}</td><td>${utils.escapeHtml(dept.name)}</td>
        <td><button class="btn btn-small" onclick="adminPage.editDepartment(${dept.id}, '${utils.escapeHtml(dept.name).replace(/'/g, "\\'")}')">Изменить</button><button class="btn btn-small" onclick="adminPage.deleteDepartment(${dept.id})">Удалить</button></td>
      </tr>`).join('') || '<tr><td colspan="3">Нет отделов</td></tr>';
    this.renderPositionsTable(deptFilter?.value || '');
  }

  async renderPositionsTable(departmentId = '') {
    const posBody = document.getElementById('positions-table-body');
    const departments = departmentId ? this.departments.filter((item) => String(item.id) === String(departmentId)) : this.departments;
    const rows = [];
    for (const dept of departments) {
      const { items } = await api.get(`/admin/departments/${dept.id}/positions`);
      (items || []).forEach((position) => rows.push({ ...position, departmentName: dept.name }));
    }
    posBody.innerHTML = rows.map((pos) => `
      <tr>
        <td>${pos.id}</td><td>${utils.escapeHtml(pos.departmentName)}</td><td>${utils.escapeHtml(pos.name)}</td>
        <td><button class="btn btn-small" onclick="adminPage.editPosition(${pos.id}, '${utils.escapeHtml(pos.name).replace(/'/g, "\\'")}')">Изменить</button><button class="btn btn-small" onclick="adminPage.deletePosition(${pos.id})">Удалить</button></td>
      </tr>`).join('') || '<tr><td colspan="4">Нет должностей</td></tr>';
  }

  async loadQuestionsForLesson(lessonId) {
    const body = document.getElementById('questions-table-body');
    body.innerHTML = '<tr><td colspan="5" class="loading">Загрузка...</td></tr>';
    try {
      const { items } = await api.get(`/admin/lessons/${lessonId}/questions`);
      this.currentQuestions = items || [];
      this.renderQuestionsTable();
    } catch (error) {
      this.handleError(error);
      body.innerHTML = '<tr><td colspan="5">Не удалось загрузить вопросы</td></tr>';
    }
  }

  renderQuestionsTable() {
    const body = document.getElementById('questions-table-body');
    if (!this.currentQuestions.length) {
      body.innerHTML = '<tr><td colspan="5">Вопросы не найдены</td></tr>';
      return;
    }
    body.innerHTML = this.currentQuestions.map((question) => `
      <tr data-question-id="${question.id}">
        <td>${question.order}</td>
        <td>${utils.escapeHtml(question.type || 'single')}</td>
        <td>${utils.escapeHtml(question.question || '')}</td>
        <td>${question.points || 1}</td>
        <td>
          <button class="btn btn-small" onclick="adminPage.editQuestion(${question.id})">Изменить</button>
          <button class="btn btn-small" onclick="adminPage.deleteQuestion(${question.id})">Удалить</button>
        </td>
      </tr>`).join('');
    if (window.Sortable) {
      this.questionSortInstance?.destroy?.();
      this.questionSortInstance = new window.Sortable(body, {
        animation: 120,
        onEnd: () => this.persistQuestionOrder()
      });
    }
  }

  async persistQuestionOrder() {
    const rows = Array.from(document.querySelectorAll('#questions-table-body tr[data-question-id]'));
    for (let index = 0; index < rows.length; index += 1) {
      const questionId = Number(rows[index].dataset.questionId);
      const question = this.currentQuestions.find((item) => Number(item.id) === questionId);
      if (!question || Number(question.order) === index + 1) continue;
      await api.patch(`/admin/questions/${questionId}`, { ...question, order: index + 1 });
      question.order = index + 1;
    }
    this.renderQuestionsTable();
  }

  buildQuestionPayloadFromForm() {
    const type = document.getElementById('question-type').value;
    const lessonId = Number(document.getElementById('question-lesson-id').value);
    const base = {
      lessonId,
      type,
      order: Number(document.getElementById('question-order').value) || 1,
      question: document.getElementById('question-text').value.trim(),
      explanation: document.getElementById('question-explanation').value.trim() || null,
      points: Number(document.getElementById('question-points').value) || 1
    };
    if (type === 'matching') {
      const pairs = (document.getElementById('question-matching-pairs').value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [left, right] = line.split('=>').map((item) => (item || '').trim());
          return { left, right };
        });
      return { ...base, matchingPairs: pairs };
    }
    const options = (document.getElementById('question-options').value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (type === 'multiple') {
      const correctIndices = (document.getElementById('question-correct-indices').value || '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((value) => Number.isInteger(value));
      return { ...base, options, correctIndices };
    }
    return { ...base, options, correctIndex: Number(document.getElementById('question-correct-index').value) || 0 };
  }

  async openQuestionModal(question = null) {
    const filterLessonId = Number(document.getElementById('questions-lesson-filter')?.value);
    const lessonSelect = document.getElementById('question-lesson-id');
    if (lessonSelect && filterLessonId) lessonSelect.value = String(filterLessonId);
    const form = document.getElementById('question-form');
    form.dataset.mode = question ? 'edit' : 'create';
    form.dataset.questionId = question ? String(question.id) : '';
    document.getElementById('question-modal-title').textContent = question ? 'Редактировать вопрос' : 'Добавить вопрос';
    document.getElementById('question-order').value = question?.order || 1;
    document.getElementById('question-type').value = question?.type || 'single';
    document.getElementById('question-text').value = question?.question || '';
    document.getElementById('question-options').value = (question?.options || []).join('\n');
    document.getElementById('question-correct-index').value = Number(question?.correctIndex) || 0;
    document.getElementById('question-correct-indices').value = (question?.correctIndices || []).join(',');
    document.getElementById('question-matching-pairs').value = (question?.matchingPairs || []).map((pair) => `${pair.left} => ${pair.right}`).join('\n');
    document.getElementById('question-explanation').value = question?.explanation || '';
    document.getElementById('question-points').value = question?.points || 1;
    this.toggleQuestionTypeFields();
    document.getElementById('question-modal').classList.add('active');
  }

  async editQuestion(id) {
    const question = this.currentQuestions.find((item) => Number(item.id) === Number(id));
    if (!question) return;
    await this.openQuestionModal(question);
  }

  async deleteQuestion(id) {
    if (!window.confirm('Удалить вопрос?')) return;
    await api.delete(`/admin/questions/${id}`);
    const lessonId = Number(document.getElementById('questions-lesson-filter').value);
    if (lessonId) await this.loadQuestionsForLesson(lessonId);
    await this.loadAll();
  }

  renderAIDynamicFields() {
    const container = document.getElementById('ai-dynamic-fields');
    const type = document.getElementById('ai-generation-type')?.value || 'course';
    const coursesOptions = ['<option value="">Выберите курс</option>'].concat(
      this.courses.map((course) => `<option value="${course.id}">${utils.escapeHtml(course.title)}</option>`)
    ).join('');
    const lessonsOptions = ['<option value="">Выберите урок</option>'].concat(
      this.lessons.map((lesson) => `<option value="${lesson.id}">${utils.escapeHtml(`${lesson.courseTitle} / ${lesson.title}`)}</option>`)
    ).join('');
    if (type === 'course') {
      container.innerHTML = `
        <div class="form-group"><label for="ai-subject-area">Предметная область</label><input id="ai-subject-area" required></div>
        <div class="form-group"><label for="ai-lesson-count">Количество уроков</label><input id="ai-lesson-count" type="number" min="1" max="20" value="3"></div>`;
      return;
    }
    if (type === 'lesson') {
      container.innerHTML = `
        <div class="form-group"><label for="ai-course-id">Курс</label><select id="ai-course-id" required>${coursesOptions}</select></div>
        <div class="form-group"><label for="ai-lesson-questions-count">Количество вопросов</label><input id="ai-lesson-questions-count" type="number" min="1" max="20" value="5"></div>`;
      return;
    }
    if (type === 'test' || type === 'question' || type === 'matching') {
      container.innerHTML = `
        <div class="form-group"><label for="ai-lesson-id">Урок</label><select id="ai-lesson-id" required>${lessonsOptions}</select></div>
        <div class="form-group"><label for="ai-question-prompt">Инструкция для AI</label><textarea id="ai-question-prompt" rows="3"></textarea></div>
        ${type === 'test' ? '<div class="form-group"><label for="ai-test-questions-count">Количество вопросов</label><input id="ai-test-questions-count" type="number" min="1" max="20" value="5"></div>' : ''}`;
    }
  }

  setAiStatus(draft) {
    const statusEl = document.getElementById('ai-generation-state');
    if (!statusEl) return;
    const status = draft?.status || 'pending';
    const labels = {
      pending: 'В очереди',
      processing: 'Обработка',
      done: 'Готово к проверке',
      error: 'Ошибка генерации',
      confirmed: 'Сохранено'
    };
    statusEl.className = `ai-status-badge ai-status-${status}`;
    const modelText = draft?.modelUsed ? ` · ${draft.modelUsed}` : '';
    statusEl.textContent = `Черновик #${draft?.id || '—'}: ${labels[status] || status}${modelText}`;
  }

  collectAIGenerationInput() {
    const type = document.getElementById('ai-generation-type').value;
    if (type === 'course') {
      return {
        subjectArea: document.getElementById('ai-subject-area').value.trim(),
        lessonCount: Number(document.getElementById('ai-lesson-count').value) || 3
      };
    }
    if (type === 'lesson') {
      return {
        courseId: Number(document.getElementById('ai-course-id').value),
        questionsCount: Number(document.getElementById('ai-lesson-questions-count').value) || 5
      };
    }
    return {
      lessonId: Number(document.getElementById('ai-lesson-id').value),
      questionPrompt: document.getElementById('ai-question-prompt')?.value?.trim() || '',
      questionsCount: Number(document.getElementById('ai-test-questions-count')?.value || 1)
    };
  }

  async submitAIGeneration(event) {
    event.preventDefault();
    const submitButton = document.getElementById('ai-generate-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Генерация...';
    try {
      const generationType = document.getElementById('ai-generation-type').value;
      const input = this.collectAIGenerationInput();
      const { draft } = await api.post('/admin/ai/generate', { generationType, input });
      this.activeDraftId = draft.id;
      this.setAiStatus(draft);
      this.startDraftPolling();
      await this.refreshActiveDraft();
    } catch (error) {
      this.handleError(error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Сгенерировать';
    }
  }

  startDraftPolling() {
    this.stopDraftPolling();
    this.aiPollDelayMs = 2000;
    this.aiPollConsecutive429 = 0;
    this.scheduleNextDraftPoll(this.aiPollDelayMs);
  }

  stopDraftPolling() {
    if (this.aiPollTimer) {
      clearTimeout(this.aiPollTimer);
      this.aiPollTimer = null;
    }
  }

  scheduleNextDraftPoll(delayMs = this.aiPollDelayMs) {
    if (!this.activeDraftId) return;
    this.stopDraftPolling();
    this.aiPollTimer = setTimeout(() => {
      this.refreshActiveDraft({ fromPolling: true });
    }, Math.max(1000, delayMs));
  }

  async refreshActiveDraft({ fromPolling = false } = {}) {
    if (!this.activeDraftId) return;
    if (fromPolling && this.aiPollRequestInFlight) {
      this.scheduleNextDraftPoll(this.aiPollDelayMs);
      return;
    }
    this.aiPollRequestInFlight = true;
    try {
      const { draft } = await api.get(`/admin/ai/drafts/${this.activeDraftId}`);
      this.aiPollConsecutive429 = 0;
      this.aiPollDelayMs = 2000;
      this.setAiStatus(draft);
      if (draft.output) {
        document.getElementById('ai-preview-json').value = JSON.stringify(draft.output, null, 2);
      }

      const isTerminal = draft.status === 'done' || draft.status === 'error' || draft.status === 'confirmed';
      if (isTerminal) {
        this.stopDraftPolling();
        if (draft.status === 'error' && draft.error) {
          utils.showToast(draft.error, 'error');
        }
        return;
      }

      this.scheduleNextDraftPoll(this.aiPollDelayMs);
    } catch (error) {
      if (error?.status === 429) {
        this.aiPollConsecutive429 += 1;
        this.aiPollDelayMs = Math.min(this.aiPollMaxDelayMs, this.aiPollDelayMs * 2);
        const statusEl = document.getElementById('ai-generation-state');
        if (statusEl) {
          statusEl.className = 'ai-status-badge ai-status-pending';
          statusEl.textContent = `Черновик #${this.activeDraftId}: слишком частые проверки, повтор через ${Math.ceil(this.aiPollDelayMs / 1000)}с`;
        }
        if (this.aiPollConsecutive429 >= 6) {
          this.stopDraftPolling();
          utils.showToast('Polling остановлен из-за лимита. Нажмите «Обновить статус» позже.', 'error');
          return;
        }
        this.scheduleNextDraftPoll(this.aiPollDelayMs);
        return;
      }

      if (fromPolling) {
        this.stopDraftPolling();
      }
      this.handleError(error);
    } finally {
      this.aiPollRequestInFlight = false;
    }
  }

  async confirmAIDraft() {
    if (!this.activeDraftId) {
      utils.showToast('Сначала запустите генерацию', 'error');
      return;
    }
    let output;
    const raw = document.getElementById('ai-preview-json').value.trim();
    if (raw) {
      try {
        output = JSON.parse(raw);
      } catch (_error) {
        utils.showToast('Невалидный JSON в предпросмотре', 'error');
        return;
      }
    }
    const { draft } = await api.post(`/admin/ai/drafts/${this.activeDraftId}/confirm`, output ? { output } : {});
    this.setAiStatus(draft);
    utils.showToast('AI-контент сохранён в БД', 'success');
    await this.loadAll();
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach((modal) => modal.classList.remove('active'));
    this.resetCourseForm();
    this.resetLessonForm();
  }

  resetCourseForm() {
    const form = document.getElementById('add-course-form');
    if (!form) return;
    form.reset();
    form.dataset.mode = 'create';
    form.dataset.courseId = '';
    document.querySelector('#add-course-modal .modal-header h3').textContent = i18n.t.addCourse;
    form.querySelector('button[type="submit"]').textContent = i18n.t.saveCourse;
    document.getElementById('new-course-instructor').value = 'Технический отдел Kerama Marazzi';
  }

  resetLessonForm() {
    const form = document.getElementById('lesson-form');
    if (!form) return;
    form.reset();
    form.dataset.mode = 'create';
    form.dataset.lessonId = '';
    document.querySelector('#lesson-modal .modal-header h3').textContent = i18n.t.addLesson;
    form.querySelector('button[type="submit"]').textContent = i18n.t.saveLesson;
    document.getElementById('lesson-order').value = '1';
    document.getElementById('lesson-duration').value = '10';
    document.getElementById('lesson-course-id').disabled = false;
  }

  openDepartmentModal(id = null, currentName = '') {
    const form = document.getElementById('department-form');
    form.dataset.mode = id ? 'edit' : 'create';
    form.dataset.id = id ? String(id) : '';
    document.getElementById('department-modal-title').textContent = id ? i18n.t.editDepartment : i18n.t.addDepartment;
    document.getElementById('department-name').value = currentName || '';
    document.getElementById('department-modal').classList.add('active');
  }

  openPositionModal(id = null, currentName = '', departmentId = '') {
    const form = document.getElementById('position-form');
    const deptSelect = document.getElementById('position-department');
    form.dataset.mode = id ? 'edit' : 'create';
    form.dataset.id = id ? String(id) : '';
    document.getElementById('position-modal-title').textContent = id ? i18n.t.editPosition : i18n.t.addPosition;
    document.getElementById('position-name').value = currentName || '';
    deptSelect.innerHTML = utils.renderSelectOptions(this.departments, {
      emptyLabel: i18n.t.selectDepartment,
      selectedValue: departmentId || document.getElementById('directory-department-filter')?.value || ''
    });
    deptSelect.disabled = Boolean(id);
    deptSelect.required = !id;
    document.getElementById('position-modal').classList.add('active');
  }

  async openCourseModal(course = null) {
    this.resetCourseForm();
    const form = document.getElementById('add-course-form');
    if (course) {
      form.dataset.mode = 'edit';
      form.dataset.courseId = String(course.id);
      document.querySelector('#add-course-modal .modal-header h3').textContent = i18n.t.editCourse;
      document.getElementById('new-course-title').value = course.title || '';
      document.getElementById('new-course-description').value = course.description || '';
      document.getElementById('new-course-full-description').value = course.fullDescription || '';
      document.getElementById('new-course-category').value = course.category || 'plita';
      document.getElementById('new-course-level').value = course.level || 'beginner';
      document.getElementById('new-course-instructor').value = course.instructor || '';
      document.getElementById('new-course-duration').value = course.duration || 0;
    }
    document.getElementById('add-course-modal').classList.add('active');
  }

  async openLessonModal(lesson = null) {
    const courses = await api.get('/admin/courses');
    if (!courses.items?.length) return utils.showToast('Сначала создайте курс', 'error');
    this.resetLessonForm();
    const select = document.getElementById('lesson-course-id');
    select.innerHTML = courses.items.map((course) => `<option value="${course.id}">${utils.escapeHtml(course.title)}</option>`).join('');
    const form = document.getElementById('lesson-form');
    if (lesson) {
      form.dataset.mode = 'edit';
      form.dataset.lessonId = String(lesson.id);
      document.querySelector('#lesson-modal .modal-header h3').textContent = i18n.t.editLesson;
      select.value = String(lesson.courseId);
      select.disabled = true;
      document.getElementById('lesson-title').value = lesson.title || '';
      document.getElementById('lesson-order').value = lesson.order || 1;
      document.getElementById('lesson-duration').value = lesson.duration || 0;
      document.getElementById('lesson-content').value = lesson.content || '';
      document.getElementById('lesson-video-url').value = lesson.videoUrl || '';
    }
    document.getElementById('lesson-modal').classList.add('active');
  }

  async openAssignModal() {
    const [usersData, coursesData] = await Promise.all([api.get('/admin/users'), api.get('/admin/courses')]);
    const userSelect = document.getElementById('assign-user');
    const courseSelect = document.getElementById('assign-course');
    userSelect.innerHTML = `<option value="">${i18n.t.selectUser}</option>` + usersData.items.filter((item) => item.role === 'user').map((user) => `<option value="${user.id}">${utils.escapeHtml(user.name)}</option>`).join('');
    courseSelect.innerHTML = `<option value="">${i18n.t.selectCourse}</option>` + coursesData.items.map((course) => `<option value="${course.id}">${utils.escapeHtml(course.title)}</option>`).join('');
    document.getElementById('assign-course-modal').classList.add('active');
  }

  addDepartment() { this.openDepartmentModal(); }
  editDepartment(id, currentName) { this.openDepartmentModal(id, currentName); }
  addPosition() { this.openPositionModal(); }
  editPosition(id, currentName) { this.openPositionModal(id, currentName); }

  async editCourse(id) {
    try { this.openCourseModal((await api.get(`/admin/courses/${id}`)).course); } catch (error) { this.handleError(error); }
  }
  async editLesson(id) {
    try { await this.openLessonModal((await api.get(`/admin/lessons/${id}`)).lesson); } catch (error) { this.handleError(error); }
  }
  async approveUser(id) { try { await api.patch(`/admin/users/${id}/approve`, {}); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deleteUser(id) { try { await api.delete(`/admin/users/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deleteCourse(id) { try { await api.delete(`/admin/courses/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deleteLesson(id) { try { await api.delete(`/admin/lessons/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deleteAssignment(id) { try { await api.delete(`/admin/assignments/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deleteDepartment(id) { try { await api.delete(`/admin/departments/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
  async deletePosition(id) { try { await api.delete(`/admin/positions/${id}`); await this.loadAll(); } catch (error) { this.handleError(error); } }
}

window.adminPage = new AdminPage();
document.addEventListener('DOMContentLoaded', () => window.adminPage.init().catch((error) => window.adminPage.handleError(error)));
