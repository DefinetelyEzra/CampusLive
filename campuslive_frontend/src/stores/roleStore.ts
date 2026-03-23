import { create } from 'zustand';
import { apiService } from '../services/api';
import type { ApiError } from '../types';

interface UserRole {
  id: string;
  roleType: 'MODERATOR' | 'POSTER' | 'WATCHER';
  expiresAt?: string;
  createdAt: string;
  moderatorTokenId?: string;
}

interface RoleStore {
  activeRoles: UserRole[];
  currentRole: UserRole | null;
  isLoading: boolean;
  error: string | null;

  fetchUserRoles: () => Promise<void>;
  fetchCurrentRole: () => Promise<void>;
  registerRole: (roleType: string, token?: string) => Promise<void>;
  deregisterRole: (roleType: string) => Promise<void>;
  setCurrentRole: (role: UserRole | null) => void;
  clearRoleData: () => void;
  clearError: () => void;
}

export const useRoleStore = create<RoleStore>((set, get) => ({
  activeRoles: [],
  currentRole: null,
  isLoading: false,
  error: null,

  fetchUserRoles: async () => {
    set({ isLoading: true, error: null });
    try {
      const roles = await apiService.getMyRoles();
      set({
        activeRoles: Array.isArray(roles) ? roles : [],
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
      const apiError = error as ApiError;
      set({
        error: apiError.message || 'Failed to fetch roles',
        activeRoles: [],
        isLoading: false
      });
    }
  },

  fetchCurrentRole: async () => {
    set({ isLoading: true, error: null });
    try {
      const currentRole = await apiService.getCurrentAppRole();
      set({
        currentRole: currentRole || null,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch current role:', error);
      const apiError = error as ApiError;
      set({
        error: apiError.message || 'Failed to fetch current role',
        currentRole: null,
        isLoading: false
      });
    }
  },

  registerRole: async (roleType: string, token?: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiService.registerRole(roleType, token);
      await get().fetchUserRoles();
      await get().fetchCurrentRole();
      set({ isLoading: false });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        error: apiError.message || 'Failed to register role',
        isLoading: false
      });
      throw apiError;
    }
  },

  deregisterRole: async (roleType: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiService.deregisterRole(roleType);
      await get().fetchUserRoles();
      await get().fetchCurrentRole();
      set({ isLoading: false });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        error: apiError.message || 'Failed to deregister role',
        isLoading: false
      });
      throw apiError;
    }
  },

  setCurrentRole: (role: UserRole | null) => {
    set({ currentRole: role });
  },

  clearRoleData: () => {
    set({
      activeRoles: [],
      currentRole: null,
      error: null,
      isLoading: false
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));