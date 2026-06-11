const NAV_ITEMS = [
  { href: 'index.html', labelKey: 'home', show: ({ user }) => !user || user.role !== 'admin' },
  { href: 'courses.html', labelKey: 'courses', show: ({ user }) => user?.role === 'user' },
  { href: 'dashboard.html', labelKey: 'dashboard', show: ({ user }) => user?.role === 'user' },
  { href: 'admin.html', labelKey: 'admin', show: ({ user }) => user?.role === 'admin' },
  { href: 'profile.html', labelKey: 'profile', show: ({ user }) => Boolean(user) },
  { href: 'login.html', labelKey: 'login', show: ({ user }) => !user, id: 'login-link' },
  { href: 'register.html', labelKey: 'register', show: ({ user }) => !user, id: 'register-link' },
  { href: '#', labelKey: 'logout', show: ({ user }) => Boolean(user), id: 'logout-link', isLogout: true }
];

class App {
  async init() {
    const user = await auth.getCurrentUser();
    this.renderNavigation(user);
    this.setupMobileMenu();
    this.setupHeroButtons(user);
    await this.protectRoutes(user);
  }

  setupHeroButtons(user) {
    const loginBtn = document.getElementById('hero-login-btn');
    const coursesBtn = document.getElementById('hero-courses-btn');
    if (!loginBtn || !coursesBtn) return;

    if (user) {
      loginBtn.style.display = 'none';
      coursesBtn.href = user.role === 'admin' ? 'admin.html' : 'courses.html';
      coursesBtn.textContent = user.role === 'admin' ? i18n.nav('admin') : i18n.nav('courses');
    } else {
      coursesBtn.href = 'login.html';
    }
  }

  renderNavigation(user) {
    const nav = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!nav) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const context = { user };
    const visibleItems = NAV_ITEMS.filter((item) => item.show(context));

    nav.innerHTML = visibleItems.map((item) => {
      const isActive = currentPath === item.href || (item.href === 'index.html' && currentPath === '');
      const idAttr = item.id ? ` id="${item.id}"` : '';
      const classes = isActive ? ' class="active"' : '';
      return `<a href="${item.href}"${idAttr}${classes}>${i18n.nav(item.labelKey)}</a>`;
    }).join('');

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink && !logoutLink.dataset.bound) {
      logoutLink.dataset.bound = 'true';
      logoutLink.addEventListener('click', (event) => {
        event.preventDefault();
        auth.logout();
      });
    }
  }

  setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!menuToggle || !nav) return;

    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  async protectRoutes(user) {
    const currentPath = window.location.pathname;
    const protectedRoutes = ['dashboard.html', 'admin.html', 'profile.html', 'courses.html', 'course-detail.html', 'lesson.html'];
    const requiresAuth = protectedRoutes.some((route) => currentPath.endsWith(route));

    if (requiresAuth && !user) {
      window.location.href = 'login.html';
      return;
    }

    if (currentPath.endsWith('admin.html') && user?.role !== 'admin') {
      window.location.href = user?.role === 'user' ? 'dashboard.html' : 'login.html';
      return;
    }

    if (user?.role === 'admin' && (currentPath.endsWith('courses.html') || currentPath.endsWith('course-detail.html') || currentPath.endsWith('lesson.html'))) {
      window.location.href = 'admin.html';
    }
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => window.app.init());
