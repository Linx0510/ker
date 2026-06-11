const ACCESS_TOKEN_KEY = 'accessToken';

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
    this.refreshPromise = null;
  }

  getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setAccessToken(token) {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  async request(path, options = {}) {
    const isAuthRequest = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/refresh');
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getAccessToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'same-origin'
    });

    if (response.status === 401 && !isAuthRequest && !options._retry) {
      const refreshed = await this.refresh();
      if (refreshed) {
        return this.request(path, { ...options, _retry: true });
      }
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error || 'Не удалось выполнить запрос');
      error.status = response.status;
      error.code = data?.code;
      error.details = data?.details || [];
      if (window.i18n?.formatError) {
        error.message = i18n.formatError(error);
      }
      throw error;
    }

    return data;
  }

  async refresh() {
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin'
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const data = await response.json();
          this.setAccessToken(data.accessToken);
          return data;
        })
        .catch(() => null)
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }

  get(path) {
    return this.request(path);
  }

  post(path, body) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  patch(path, body) {
    return this.request(path, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(path) {
    return this.request(path, {
      method: 'DELETE'
    });
  }

  async download(path, fallbackFilename) {
    const requestFile = async (retry = false) => {
      const headers = new Headers();
      const token = this.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(`${this.baseUrl}${path}`, {
        headers,
        credentials: 'same-origin'
      });

      if (response.status === 401 && !retry) {
        const refreshed = await this.refresh();
        if (refreshed) return requestFile(true);
      }

      return response;
    };

    const response = await requestFile();
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error = new Error(data?.error || 'Не удалось скачать файл');
      error.status = response.status;
      error.code = data?.code;
      if (window.i18n?.formatError) {
        error.message = i18n.formatError(error);
      }
      throw error;
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
    const plainMatch = disposition.match(/filename="([^"]+)"/i);
    let filename = fallbackFilename;
    if (utfMatch) {
      try {
        filename = decodeURIComponent(utfMatch[1]);
      } catch {
        filename = utfMatch[1];
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1];
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

window.api = new ApiClient();
