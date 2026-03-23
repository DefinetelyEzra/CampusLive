import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import type {
    AuthResponse,
    LoginCredentials,
    RegisterData,
    Event,
    Location,
    Post,
    CreateEventRequest,
    CreateLocationRequest,
    CreatePostRequest,
    EventAttendance,
    User,
    ApiError,
    LocationBound,
    UserAppRole,
    ModeratorToken,
    SystemStats,
    UserWithStats,
    EventAnalytics
} from '../types';

class ApiService {
    private readonly api: AxiosInstance;
    private onUnauthorized?: () => void;

    constructor() {
        this.api = axios.create({
            baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        axiosRetry(this.api, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

        // Request interceptor to add auth token
        this.api.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(new Error(error.message || 'Request error'))
        );

        // Response interceptor for error handling
        this.api.interceptors.response.use(
            (response) => response,
            (error: AxiosError<{ error?: string }>) => {
                const status = error.response?.status;
                // Try to read the original request config safely
                const reqConfig = (error.config ?? {}) as AxiosRequestConfig;
                const reqHeaders = reqConfig.headers || {};
                const hadAuthHeader = Boolean(reqHeaders.Authorization || reqHeaders.authorization);
                const reqUrl: string = reqConfig.url || '';
                const baseUrl: string = reqConfig.baseURL ?? '';

                // normalize to a predictable path 
                const normalizedPath = (() => {
                    try {
                        if (reqUrl.startsWith('http')) return new URL(reqUrl).pathname;
                        if (baseUrl.startsWith('http')) return new URL(baseUrl + reqUrl).pathname;
                        return (baseUrl + reqUrl);
                    } catch {
                        return reqUrl;
                    }
                })();

                // Detect typical auth endpoints 
                const isAuthEndpoint =
                    normalizedPath.includes('/auth/login') ||
                    normalizedPath.includes('/auth/register') ||
                    normalizedPath === '/auth' ||
                    normalizedPath.startsWith('/auth/');

                if (status === 401) {
                    const storedToken = localStorage.getItem('token');
                    const shouldTriggerUnauthorized =
                        hadAuthHeader || (!!storedToken && !isAuthEndpoint);

                    if (shouldTriggerUnauthorized) {
                        // Clear local auth state 
                        this.removeAuthToken();
                        localStorage.removeItem('user');

                        // Call the app-level handler 
                        try {
                            this.onUnauthorized?.();
                        } catch (e) {
                            console.error('Unauthorized handler error:', e);
                        }
                    }
                }

                const apiError: ApiError = {
                    message: error.response?.data?.error || error.message || 'Response error',
                    code: error.response?.status?.toString(),
                    details: error.response?.data,
                };
                const errorWithDetails = new Error(apiError.message);
                Object.assign(errorWithDetails, apiError);
                return Promise.reject(errorWithDetails);
            }
        );
    }

    // Authentication endpoints
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response: AxiosResponse<{
            success?: boolean;
            message?: string;
            data?: { user: User; token: string };
            user?: User;
            token?: string;
        }> = await this.api.post('/auth/login', credentials);

        console.log('Raw login response:', response.data);

        // Handle different response structures
        if (response.data.data) {
            return {
                success: true,
                message: response.data.message || 'Login successful',
                user: response.data.data.user,
                token: response.data.data.token
            };
        } else if (response.data.success !== undefined) {
            return {
                success: response.data.success,
                message: response.data.message || 'Login successful',
                user: response.data.user,
                token: response.data.token
            };
        } else if (response.data.user && response.data.token) {
            return {
                success: true,
                message: 'Login successful',
                user: response.data.user,
                token: response.data.token
            };
        } else {
            throw new Error('Invalid response format from server');
        }
    }

    async register(userData: RegisterData): Promise<AuthResponse> {
        const response: AxiosResponse<{
            success?: boolean;
            message?: string;
            data?: { user: User; token: string };
            user?: User;
            token?: string;
        }> = await this.api.post('/auth/register', userData);

        console.log('Raw register response:', response.data);

        // Handle different response structures  
        if (response.data.data) {
            return {
                success: true,
                message: response.data.message || 'Registration successful',
                user: response.data.data.user,
                token: response.data.data.token
            };
        } else if (response.data.success !== undefined) {
            return {
                success: response.data.success,
                message: response.data.message || 'Registration successful',
                user: response.data.user,
                token: response.data.token
            };
        } else if (response.data.user && response.data.token) {
            return {
                success: true,
                message: 'Registration successful',
                user: response.data.user,
                token: response.data.token
            };
        } else {
            throw new Error('Invalid response format from server');
        }
    }

    async logout(): Promise<void> {
        await this.api.post('/auth/logout');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    async checkAuthStatus(): Promise<boolean> {
        try {
            await this.getCurrentUser();
            return true;
        } catch {
            return false;
        }
    }

    async getCurrentUser(): Promise<User> {
        const response: AxiosResponse<{ success: boolean; data: User }> = await this.api.get('/auth/profile');
        return response.data.data;
    }

    // Location endpoints
    async getAllLocations(): Promise<Location[]> {
        const response: AxiosResponse<{ success: boolean; message: string; data: Location[] }> = await this.api.get('/locations');
        return response.data.data || [];
    }

    async getLocationById(id: string): Promise<Location> {
        const response: AxiosResponse<Location> = await this.api.get(`/locations/${id}`);
        return response.data;
    }

    async createLocation(locationData: CreateLocationRequest): Promise<Location> {
        const response: AxiosResponse<{ success: boolean; data: Location }> = await this.api.post('/locations', locationData);
        return response.data.data || response.data;
    }

    async updateLocation(id: string, locationData: Partial<CreateLocationRequest>): Promise<Location> {
        const response: AxiosResponse<{ success: boolean; data: Location }> = await this.api.put(`/locations/${id}`, locationData);
        return response.data.data || response.data;
    }

    async deleteLocation(id: string): Promise<void> {
        await this.api.delete(`/locations/${id}`);
    }

    // Event endpoints
    async getAllEvents(isLive?: boolean): Promise<Event[]> {
        const params = isLive === undefined ? {} : { isLive: isLive.toString() };
        const response: AxiosResponse<{ success: boolean; message: string; data: Event[] }> = await this.api.get('/events', { params });
        return response.data.data || [];
    }

    async getEventById(id: string): Promise<Event> {
        const response: AxiosResponse<{ success: boolean; message: string; data: Event }> = await this.api.get(`/events/${id}`);

        if (response.data && 'success' in response.data && response.data.data) {
            return response.data.data;
        }

        throw new Error('Invalid response format from server');
    }

    async createEvent(eventData: CreateEventRequest): Promise<Event | {
        event: Event;
        accessKey: string;
        message: string
    } | {
        hasConflicts: true;
        totalInstances: number;
        conflictingInstances: Array<{
            startTime: string;
            endTime: string;
            conflictsWith: string[];
        }>;
        eventData: CreateEventRequest;
        locationName: string;
    }> {
        const response: AxiosResponse<{
            success?: boolean;
            message?: string;
            data?: Event;
            event?: Event;
            accessKey?: string;
            hasConflicts?: boolean;
            totalInstances?: number;
            conflictingInstances?: Array<{
                startTime: string;
                endTime: string;
                conflictsWith: string[];
            }>;
            locationName?: string;
        }> = await this.api.post('/events', eventData);

        // Check for recurring conflicts
        if (response.data.hasConflicts) {
            return {
                hasConflicts: true,
                totalInstances: response.data.totalInstances!,
                conflictingInstances: response.data.conflictingInstances!,
                eventData,
                locationName: response.data.locationName!
            };
        }

        // Handle both direct event response and wrapped response with access key
        if (response.data.accessKey) {
            return {
                event: response.data.event || response.data.data!,
                accessKey: response.data.accessKey,
                message: response.data.message || 'Event created successfully'
            };
        }

        return response.data.data || response.data.event || response.data as Event;
    }

    async updateEvent(eventId: string, updateData: {
        title?: string;
        description?: string;
        startTime?: string;
        endTime?: string;
    }): Promise<Event> {
        const response: AxiosResponse<{ success: boolean; message: string; data: Event }> =
            await this.api.patch(`/events/${eventId}`, updateData);
        return response.data.data || response.data;
    }

    async toggleEventLive(id: string, isLive: boolean): Promise<Event> {
        const response: AxiosResponse<{ success: boolean; data: Event }> = await this.api.patch(`/events/${id}/toggle-live`, { isLive });
        return response.data.data || response.data;
    }

    async endEvent(id: string): Promise<Event> {
        const response: AxiosResponse<{ success: boolean; data: Event }> = await this.api.patch(`/events/${id}/end`);
        return response.data.data || response.data;
    }

    async deleteEvent(id: string): Promise<void> {
        await this.api.delete(`/events/${id}`);
    }

    // Event attendance endpoints
    async joinEvent(
        eventId: string,
        role: string = 'WATCHER',
        location?: { latitude: number; longitude: number },
        accessKey?: string
    ): Promise<EventAttendance> {
        const requestBody: {
            role: string;
            latitude?: number;
            longitude?: number;
            accessKey?: string;
        } = { role };

        if (location) {
            requestBody.latitude = location.latitude;
            requestBody.longitude = location.longitude;
        }

        if (accessKey) {
            requestBody.accessKey = accessKey;
        }

        const response: AxiosResponse<{ success: boolean; data: EventAttendance; message: string } | EventAttendance> =
            await this.api.post(`/events/${eventId}/join`, requestBody);

        if ('data' in response.data && response.data.data) {
            return response.data.data;
        } else if ('id' in response.data && 'eventId' in response.data && 'userId' in response.data && 'role' in response.data) {
            return response.data;
        }

        throw new Error('Invalid response format from server');
    }

    async updateUserLocation(eventId: string, latitude: number, longitude: number): Promise<{ distance: number; isWithinBounds: boolean }> {
        const response: AxiosResponse<{ distance: number; isWithinBounds: boolean }> = await this.api.post(`/events/${eventId}/update-location`, {
            latitude,
            longitude
        });
        return response.data;
    }

    async setEventLocationBounds(eventId: string, centerLat: number, centerLng: number, radiusMeters: number): Promise<LocationBound> {
        const response: AxiosResponse<LocationBound> = await this.api.post(`/events/${eventId}/set-bounds`, {
            centerLat,
            centerLng,
            radiusMeters
        });
        return response.data;
    }

    async leaveEvent(eventId: string): Promise<void> {
        await this.api.post(`/events/${eventId}/leave`);
    }

    async getEventAttendees(eventId: string): Promise<{ count: number; attendees: EventAttendance[] }> {
        const response: AxiosResponse<{ count: number; attendees: EventAttendance[] }> = await this.api.get(`/events/${eventId}/attendees`);
        return response.data;
    }

    // Returns SINGLE active attendance (used for checking current attendance)
    async getMyAttendance(): Promise<{ success: boolean; data: EventAttendance | null }> {
        const response: AxiosResponse<{ success: boolean; data: EventAttendance | null }> = await this.api.get('/events/my/attendance');
        return response.data;
    }

    // Returns ALL active attendances (used for Watchers with multiple events)
    async getMyAttendances(): Promise<{ success: boolean; data: EventAttendance[] }> {
        const response: AxiosResponse<{ success: boolean; data: EventAttendance[] }> =
            await this.api.get('/events/my/attendances');
        return response.data;
    }

    // Role management endpoints
    async generateModeratorTokens(count: number = 1): Promise<ModeratorToken[]> {
        const response: AxiosResponse<ModeratorToken[]> = await this.api.post('/roles/moderator-tokens', { count });
        return response.data;
    }

    async registerRole(roleType: string, token?: string): Promise<UserAppRole> {
        const response: AxiosResponse<UserAppRole> = await this.api.post('/roles/register', { roleType, token });
        return response.data;
    }

    async getCurrentAppRole(): Promise<UserAppRole | null> {
        try {
            const response: AxiosResponse<{ success: boolean; data: UserAppRole | null }> = await this.api.get('/roles/current');
            return response.data.data;
        } catch (error) {
            console.error('Failed to get current role:', error);
            throw error;
        }
    }

    async deregisterRole(roleType: string): Promise<void> {
        await this.api.delete('/roles/deregister', { data: { roleType } });
    }

    async getMyRoles(): Promise<UserAppRole[]> {
        try {
            const response: AxiosResponse<{ success: boolean; data: UserAppRole[] }> = await this.api.get('/roles/my-roles');
            return response.data.data || [];
        } catch (error) {
            console.error('Failed to get my roles:', error);
            throw error;
        }
    }

    // Post endpoints
    async getPostsByLocation(locationId: string): Promise<Post[]> {
        const response: AxiosResponse<Post[]> = await this.api.get(`/posts/location/${locationId}`);
        return response.data;
    }

    async getPostsByEvent(eventId: string): Promise<Post[]> {
        const response: AxiosResponse<Post[]> = await this.api.get(`/posts/event/${eventId}`);
        return response.data;
    }

    async createPost(postData: CreatePostRequest): Promise<Post> {
        const formData = new FormData();

        if (postData.content) {
            formData.append('content', postData.content);
        }

        formData.append('locationId', postData.locationId);

        if (postData.eventId) {
            formData.append('eventId', postData.eventId);
        }

        if (postData.media) {
            formData.append('media', postData.media);
        }

        const response: AxiosResponse<Post> = await this.api.post('/posts', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    async getMyAccessiblePosts(): Promise<Post[]> {
        const response: AxiosResponse<Post[]> = await this.api.get('/posts/my/accessible');
        return response.data;
    }

    async deletePost(id: string): Promise<void> {
        await this.api.delete(`/posts/${id}`);
    }

    // Admin endpoints
    async getAllUsers(): Promise<UserWithStats[]> {
        const response: AxiosResponse<{ success: boolean; data: UserWithStats[] }> = await this.api.get('/admin/users');
        return response.data.data;
    }

    async getAllModeratorTokens(): Promise<ModeratorToken[]> {
        const response: AxiosResponse<{ success: boolean; data: ModeratorToken[] }> = await this.api.get('/admin/moderator-tokens');
        return response.data.data;
    }

    async getActiveModerators(): Promise<UserAppRole[]> {
        const response: AxiosResponse<{ success: boolean; data: UserAppRole[] }> = await this.api.get('/admin/active-moderators');
        return response.data.data;
    }

    async getSystemStats(): Promise<SystemStats> {
        const response: AxiosResponse<{ success: boolean; data: SystemStats }> = await this.api.get('/admin/stats');
        return response.data.data;
    }

    async getUserActivity(userId: string): Promise<User> {
        const response: AxiosResponse<{ success: boolean; data: User }> = await this.api.get(`/admin/users/${userId}/activity`);
        return response.data.data;
    }

    async deleteUser(userId: string): Promise<void> {
        await this.api.delete(`/auth/delete/${userId}`);
    }

    async deleteModeratorToken(tokenId: string): Promise<void> {
        await this.api.delete(`/admin/moderator-tokens/${tokenId}`);
    }

    async revokeUserRole(userId: string, roleType: string): Promise<void> {
        await this.api.delete(`/admin/users/${userId}/roles/${roleType}`);
    }

    async getEventAnalytics(eventId: string): Promise<EventAnalytics> {
        const response: AxiosResponse<{ success: boolean; data: EventAnalytics }> = await this.api.get(`/admin/events/${eventId}/analytics`);
        return response.data.data;
    }

    // Utility methods
    setAuthToken(token: string): void {
        localStorage.setItem('token', token);
        this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    removeAuthToken(): void {
        localStorage.removeItem('token');
        delete this.api.defaults.headers.common['Authorization'];
    }

    setUnauthorizedHandler(fn?: () => void) {
        this.onUnauthorized = fn;
    }

    // File upload utility (for media posts)
    async uploadMedia(file: File, eventId?: string, locationId?: string): Promise<string> {
        const formData = new FormData();
        formData.append('media', file);

        if (eventId) {
            formData.append('eventId', eventId);
        }

        if (locationId) {
            formData.append('locationId', locationId);
        }

        const response: AxiosResponse<{ mediaUrl: string }> = await this.api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data.mediaUrl;
    }

    // Health check
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response: AxiosResponse<{ status: string; timestamp: string }> = await this.api.get('/health');
        return response.data;
    }
}

export const apiService = new ApiService();
export default apiService;