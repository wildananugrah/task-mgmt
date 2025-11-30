import axios, { AxiosError } from 'axios';

// Create axios instance
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
export const tokenManager = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Also clear auth state from the store
    // We import the store dynamically to avoid circular dependencies
    import('../stores/auth.store').then(({ useAuthStore }) => {
      useAuthStore.getState().clearAuth();
    });
  },
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Skip token refresh for login endpoint to prevent redirect loops
    if (originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post('/api/auth/refresh', {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        tokenManager.setTokens(accessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        tokenManager.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Generic CRUD operations for models
export const modelApi = {
  // List with pagination, filtering, and sorting
  list: async (model: string, params?: any) => {
    const response = await apiClient.get(`/${model}`, { params });
    return response.data;
  },

  // Get single item
  get: async (model: string, id: string) => {
    const response = await apiClient.get(`/${model}/${id}`);
    return response.data;
  },

  // Create new item
  create: async (model: string, data: any) => {
    const response = await apiClient.post(`/${model}`, data);
    return response.data;
  },

  // Update existing item
  update: async (model: string, id: string, data: any) => {
    const response = await apiClient.put(`/${model}/${id}`, data);
    return response.data;
  },

  // Delete item
  delete: async (model: string, id: string) => {
    const response = await apiClient.delete(`/${model}/${id}`);
    return response.data;
  },

  // Bulk delete
  bulkDelete: async (model: string, ids: string[]) => {
    const response = await apiClient.post(`/${model}/bulk-delete`, { ids });
    return response.data;
  },
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data;

    console.log('Login response:', { accessToken: !!accessToken, refreshToken: !!refreshToken, user });

    if (accessToken && refreshToken) {
      tokenManager.setTokens(accessToken, refreshToken);
      console.log('Tokens saved, checking localStorage:', {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken')
      });
    }

    return { user };
  },

  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      tokenManager.clearTokens();
      window.location.href = '/login';
    }
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};