import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, LoginCredentials, RegisterData } from '../types';
import { apiService } from '../services/api';
import { socketService } from '../services/socketService';
import { useRoleStore } from './roleStore';
import { useSocketStore } from './socketStore';

interface AuthStore extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>;
    register: (userData: RegisterData) => Promise<boolean>;
    logout: () => void;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (credentials: LoginCredentials) => {
                set({ isLoading: true });
                try {
                    const response = await apiService.login(credentials);

                    // Check if we have the required data regardless of success flag
                    if (response.token && response.user) {
                        apiService.setAuthToken(response.token);

                        set({
                            user: response.user,
                            token: response.token,
                            isAuthenticated: true,
                            isLoading: false,
                        });

                        // Connect socket after state is set
                        setTimeout(() => {
                            const { connectSocket } = useSocketStore.getState();
                            connectSocket();
                        }, 100);

                        return true;
                    } else {
                        console.log('Login failed - missing token or user:', response);
                        set({ isLoading: false });
                        throw new Error('Invalid email or password. Please check your credentials.');
                    }
                } catch (error: unknown) {
                    set({ isLoading: false });
                    console.error('Login error details:', error);

                    // Handle different types of errors
                    if (error instanceof Error) {
                        // Network or server errors
                        if (error.message.includes('fetch')) {
                            throw new Error('Unable to connect to server. Please check your internet connection.');
                        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                            throw new Error('Invalid email or password. Please try again.');
                        } else if (error.message.includes('404')) {
                            throw new Error('Account not found. Please check your email address.');
                        } else if (error.message.includes('500')) {
                            throw new Error('Server error. Please try again later.');
                        } else {
                            throw error; // Re-throw the original error if it has a specific message
                        }
                    } else {
                        throw new Error('Login failed. Please try again.');
                    }
                }
            },

            register: async (userData: RegisterData) => {
                set({ isLoading: true });
                try {
                    const response = await apiService.register(userData);
                    console.log('Register response:', response); // Debug log

                    // Check if we have the required data regardless of success flag
                    if (response.token && response.user) {
                        apiService.setAuthToken(response.token);
                        socketService.connect(response.token);

                        set({
                            user: response.user,
                            token: response.token,
                            isAuthenticated: true,
                            isLoading: false,
                        });
                        return true;
                    } else {
                        console.log('Registration failed - missing token or user:', response);
                        set({ isLoading: false });
                        throw new Error('Registration failed. Please try again.');
                    }
                } catch (error: unknown) {
                    set({ isLoading: false });
                    console.error('Registration error details:', error);

                    // Handle different types of errors
                    if (error instanceof Error) {
                        // Network or server errors
                        if (error.message.includes('fetch')) {
                            throw new Error('Unable to connect to server. Please check your internet connection.');
                        } else if (error.message.includes('400')) {
                            throw new Error('Invalid registration data. Please check your information.');
                        } else if (error.message.includes('409') || error.message.includes('already exists')) {
                            throw new Error('An account with this email or username already exists.');
                        } else if (error.message.includes('pau.edu.ng')) {
                            throw new Error('Please use a valid Pan-Atlantic University email address (@pau.edu.ng).');
                        } else if (error.message.includes('500')) {
                            throw new Error('Server error. Please try again later.');
                        } else {
                            throw error; // Re-throw the original error if it has a specific message
                        }
                    } else {
                        throw new Error('Registration failed. Please try again.');
                    }
                }
            },

            logout: () => {
                apiService.removeAuthToken();
                const { disconnectSocket } = useSocketStore.getState();
                disconnectSocket();
                useRoleStore.getState().clearRoleData();
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });
            },

            setUser: (user: User | null) => {
                set({ user, isAuthenticated: !!user });
            },

            setLoading: (loading: boolean) => {
                set({ isLoading: loading });
            },

            refreshUser: async () => {
                try {
                    const user = await apiService.getCurrentUser();
                    set({ user });
                    if (get().token && !socketService.isConnected) {
                        socketService.connect(get().token!);
                    }
                } catch (error) {
                    console.error('Failed to refresh user:', error);
                    get().logout();
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);