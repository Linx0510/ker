async function loadRegisterDirectories() {
  const deptSelect = document.getElementById('reg-department');
  const posSelect = document.getElementById('reg-position');
  if (!deptSelect || !posSelect) return;

  try {
    await utils.setupDepartmentPositionCascade({
      deptSelectEl: deptSelect,
      posSelectEl: posSelect,
      loadDepartments: async () => {
        const { items } = await api.get('/auth/directories/departments');
        return items;
      },
      loadPositions: async (departmentId) => {
        const { items } = await api.get(`/auth/directories/departments/${departmentId}/positions`);
        return items;
      }
    });
  } catch (_error) {
    // directories optional before migration
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadRegisterDirectories();

  const form = document.getElementById('register-form');
  const errorEl = document.getElementById('register-error');
  const successEl = document.getElementById('register-success');

  function showMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
  }

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';

    const deptSelect = document.getElementById('reg-department');
    const posSelect = document.getElementById('reg-position');
    const validationError = utils.validateDeptPositionSelection(deptSelect, posSelect);
    if (validationError) {
      showMessage(errorEl, validationError);
      return;
    }

    const payload = {
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      ...utils.buildDeptPositionPayload(deptSelect, posSelect)
    };

    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (payload.password !== confirmPassword) {
      showMessage(errorEl, i18n.t.passwordsMismatch);
      return;
    }

    await utils.withFormLoading(form, async () => {
      try {
        const result = await api.post('/auth/register', payload);
        if (result.pending) {
          showMessage(successEl, i18n.t.registrationPending);
          form.reset();
          await loadRegisterDirectories();
          return;
        }
        api.setAccessToken(result.accessToken);
        auth.currentUser = result.user;
        showMessage(successEl, i18n.t.registrationComplete);
        window.location.href = 'dashboard.html';
      } catch (error) {
        showMessage(errorEl, i18n.formatError(error));
      }
    });
  });
});
