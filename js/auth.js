class AuthService {
  constructor() {
    this.currentUser = null;
  }

  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    api.setAccessToken(data.accessToken);
    this.currentUser = data.user;
    return data.user;
  }

  async register(payload) {
    return api.post('/auth/register', payload);
  }

  async getCurrentUser(force = false) {
    if (this.currentUser && !force) {
      return this.currentUser;
    }

    const token = api.getAccessToken();
    if (!token) {
      this.currentUser = null;
      return null;
    }

    try {
      const data = await api.get('/auth/me');
      this.currentUser = data.user;
      return this.currentUser;
    } catch (_error) {
      this.currentUser = null;
      api.setAccessToken(null);
      return null;
    }
  }

  async logout() {
    try {
      await api.post('/auth/logout', {});
    } catch (_error) {
      // ignore logout cleanup errors
    }
    api.setAccessToken(null);
    this.currentUser = null;
    window.location.href = 'login.html';
  }

  async isAuthenticated() {
    return Boolean(await this.getCurrentUser());
  }

  async isAdmin() {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  }
}

window.auth = new AuthService();
