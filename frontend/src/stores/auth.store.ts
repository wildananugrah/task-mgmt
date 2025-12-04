import { create } from 'zustand';
import { authApi, tokenManager } from '../lib/api-client';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const { user } = await authApi.login(email, password);
      set({ user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  register: async (data: any) => {
    try {
      await authApi.register(data);
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      if (!tokenManager.getAccessToken()) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const user = await authApi.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearAuth: () => {
    set({ user: null, isAuthenticated: false });
  },
}));