function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateRu(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showErrorBanner(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="error-banner" role="alert">${escapeHtml(message)}</div>`;
}

async function withFormLoading(form, callback) {
  const submit = form.querySelector('[type="submit"]');
  const originalText = submit?.textContent || '';
  if (submit) {
    submit.disabled = true;
    submit.textContent = window.i18n?.t?.saving || 'Сохранение...';
  }
  try {
    return await callback();
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }
}

function renderSelectOptions(items, { valueKey = 'id', labelKey = 'name', emptyLabel = '', selectedValue = '' } = {}) {
  const empty = emptyLabel ? `<option value="">${escapeHtml(emptyLabel)}</option>` : '';
  const options = (items || []).map((item) => {
    const value = item[valueKey];
    const selected = String(value) === String(selectedValue) ? ' selected' : '';
    return `<option value="${value}"${selected}>${escapeHtml(item[labelKey])}</option>`;
  }).join('');
  return empty + options;
}

async function setupDepartmentPositionCascade({
  deptSelectEl,
  posSelectEl,
  loadDepartments,
  loadPositions,
  selectedDeptId = '',
  selectedPosId = '',
  emptyDeptLabel = 'Выберите отдел',
  emptyPosLabel = 'Сначала выберите отдел',
  choosePosLabel = 'Выберите должность'
}) {
  if (!deptSelectEl || !posSelectEl) return;

  const fillPositions = async (departmentId, keepPosId = '') => {
    if (!departmentId) {
      posSelectEl.innerHTML = `<option value="">${escapeHtml(emptyPosLabel)}</option>`;
      posSelectEl.disabled = true;
      posSelectEl.value = '';
      return;
    }
    posSelectEl.disabled = false;
    const items = await loadPositions(departmentId);
    posSelectEl.innerHTML = renderSelectOptions(items, {
      emptyLabel: choosePosLabel,
      selectedValue: keepPosId
    });
  };

  deptSelectEl.onchange = () => fillPositions(deptSelectEl.value);

  const departments = await loadDepartments();
  deptSelectEl.innerHTML = renderSelectOptions(departments, {
    emptyLabel: emptyDeptLabel,
    selectedValue: selectedDeptId
  });

  if (selectedDeptId) {
    await fillPositions(selectedDeptId, selectedPosId);
  } else {
    posSelectEl.innerHTML = `<option value="">${escapeHtml(emptyPosLabel)}</option>`;
    posSelectEl.disabled = true;
  }
}

function buildDeptPositionPayload(deptSelectEl, posSelectEl) {
  const result = {};
  const deptId = deptSelectEl?.value;
  const posId = posSelectEl?.value;
  if (posId && !deptId) {
    result.positionId = Number(posId);
    return result;
  }
  if (deptId) result.departmentId = Number(deptId);
  if (posId) result.positionId = Number(posId);
  return result;
}

function validateDeptPositionSelection(deptSelectEl, posSelectEl) {
  const posId = posSelectEl?.value;
  const deptId = deptSelectEl?.value;
  if (posId && !deptId) {
    return window.i18n?.t?.selectDepartmentFirst || 'Сначала выберите отдел';
  }
  return null;
}

window.utils = {
  escapeHtml,
  formatDateRu,
  showToast,
  showErrorBanner,
  withFormLoading,
  renderSelectOptions,
  setupDepartmentPositionCascade,
  buildDeptPositionPayload,
  validateDeptPositionSelection
};
