class DashboardPage {
  async init() {
    if (!window.location.pathname.endsWith('dashboard.html')) return;

    try {
      const user = await auth.getCurrentUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      const title = document.getElementById('welcome-title');
      if (title) title.textContent = `${i18n.t.welcome}, ${user.name}!`;
    } catch (error) {
      utils.showToast(error.message || i18n.t.loadError, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new DashboardPage().init());
