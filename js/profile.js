class ProfilePage {
  async init() {
    if (!window.location.pathname.endsWith('profile.html')) return;
    const user = await auth.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    this.bindTabs();
    this.bindForms();
    await this.loadProfile();
  }

  bindTabs() {
    const menuItems = document.querySelectorAll('.profile-menu-item');
    const contents = document.querySelectorAll('.profile-tab-content');
    menuItems.forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        menuItems.forEach((node) => node.classList.remove('active'));
        contents.forEach((node) => node.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(`${item.dataset.tab}-tab`).classList.add('active');
      });
    });
  }

  bindForms() {
    document.getElementById('personal-info-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await utils.withFormLoading(event.target, async () => {
        try {
          const payload = {
            name: document.getElementById('profile-name-input').value.trim(),
            email: document.getElementById('profile-email-input').value.trim(),
            phone: document.getElementById('profile-phone-input').value.trim(),
            company: 'Kerama Marazzi',
            bio: document.getElementById('profile-bio-input').value.trim()
          };
          const deptSelect = document.getElementById('profile-department-select');
          const posSelect = document.getElementById('profile-position-select');
          const validationError = utils.validateDeptPositionSelection(deptSelect, posSelect);
          if (validationError) {
            utils.showToast(validationError, 'error');
            return;
          }
          if (deptSelect) {
            Object.assign(payload, utils.buildDeptPositionPayload(deptSelect, posSelect));
          }
          if (!deptSelect) {
            payload.position = document.getElementById('profile-position-input')?.value.trim() || '';
            payload.department = document.getElementById('profile-department-input')?.value.trim() || '';
          }

          const data = await api.patch('/users/me/profile', payload);
          auth.currentUser = data.user;
          await this.loadProfile();
          utils.showToast(i18n.t.saved, 'success');
        } catch (error) {
          utils.showToast(i18n.formatError(error), 'error');
        }
      });
    });

    document.getElementById('security-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      if (newPassword !== confirmPassword) {
        utils.showToast(i18n.t.passwordsMismatch, 'error');
        return;
      }
      await utils.withFormLoading(event.target, async () => {
        try {
          await api.patch('/users/me/password', {
            currentPassword: document.getElementById('current-password').value,
            newPassword
          });
          event.target.reset();
          utils.showToast('Пароль обновлён', 'success');
        } catch (error) {
          utils.showToast(i18n.formatError(error), 'error');
        }
      });
    });

  }

  async populateDepartmentSelects(user) {
    const deptSelect = document.getElementById('profile-department-select');
    const posSelect = document.getElementById('profile-position-select');
    if (!deptSelect || !posSelect) return;

    await utils.setupDepartmentPositionCascade({
      deptSelectEl: deptSelect,
      posSelectEl: posSelect,
      loadDepartments: async () => {
        const { items } = await api.get('/users/me/directories/departments');
        return items;
      },
      loadPositions: async (departmentId) => {
        const { items } = await api.get(`/users/me/directories/departments/${departmentId}/positions`);
        return items;
      },
      selectedDeptId: user.departmentId || '',
      selectedPosId: user.positionId || ''
    });
  }

  async loadProfile() {
    const data = await api.get('/users/me/profile');
    const user = data.user;
    document.getElementById('sidebar-user-name').textContent = user.name;
    document.getElementById('sidebar-user-email').textContent = user.email;
    document.getElementById('profile-name-input').value = user.name || '';
    document.getElementById('profile-email-input').value = user.email || '';
    document.getElementById('profile-phone-input').value = user.phone || '';
    document.getElementById('profile-bio-input').value = user.bio || '';

    try {
      await this.populateDepartmentSelects(user);
    } catch (_error) {
      // directories API may be unavailable for non-admin; text fields remain
    }

    await this.renderCertificates();
  }

  async renderCertificates() {
    const container = document.getElementById('certificates-list');
    if (!container) return;

    const dashboard = await api.get('/users/me/dashboard');
    const completedAssignments = (dashboard.assignments || []).filter((item) => item.progress === 100);

    if (!completedAssignments.length) {
      container.innerHTML = '<div class="empty-message"><p>Сертификатов пока нет.</p><p>Завершите курс на 100%, чтобы получить сертификат.</p></div>';
      return;
    }

    container.innerHTML = completedAssignments.map((assignment) => `
      <div class="certificate-card">
        <div class="certificate-icon"><i class="fas fa-award"></i></div>
        <h4>${utils.escapeHtml(assignment.course.title)}</h4>
        <p>Прогресс: ${assignment.progress}%</p>
        <p>Назначен: ${utils.formatDateRu(assignment.assignedAt)}</p>
        <button type="button" class="btn btn-small btn-outline cert-download" data-assignment-id="${assignment.id}">Скачать PDF</button>
      </div>
    `).join('');

    container.querySelectorAll('.cert-download').forEach((button) => {
      button.addEventListener('click', () => this.downloadCertificate(Number(button.dataset.assignmentId)));
    });
  }

  async downloadCertificate(assignmentId) {
    const buttons = document.querySelectorAll(`.cert-download[data-assignment-id="${assignmentId}"]`);
    buttons.forEach((button) => {
      button.disabled = true;
      button.textContent = 'Загрузка…';
    });

    try {
      await api.download(
        `/users/me/certificates/${assignmentId}/pdf`,
        `sertifikat-${assignmentId}.pdf`
      );
      utils.showToast('Сертификат скачан', 'success');
    } catch (error) {
      utils.showToast(error.message, 'error');
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
        button.textContent = 'Скачать PDF';
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new ProfilePage().init());
