export interface User {
    id: string;
    username: string;
    email: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

export interface Location {
    id: string;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    category: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    posts?: Post[];
    events?: Event[];
}

export type ParticipantRole = 'MODERATOR' | 'POSTER' | 'WATCHER';
export type status = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface Event {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    isLive: boolean;
    status: status;
    maxAttendees?: number;
    createdAt: string;
    updatedAt: string;
    organizerId: string;
    locationId: string;
    organizer: {
        id: string;
        username: string;
    };
    location: {
        latitude: number;
        longitude: number;
        id: string;
        name: string;
    };
    attendeeCount: number;
    totalAttendees?: number;
    activeAttendees?: number;
    watcherCount?: number;
    posterCount?: number;
    moderatorCount?: number;
    isUserAttending: boolean;
    canJoin?: boolean;
    posts?: Post[];
    attendances?: EventAttendance[];

    // Advanced options
    isPrivate?: boolean;
    accessKey?: string;
    isRecurring?: boolean;
    recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    parentEventId?: string;
}

export interface Post {
    id: string;
    content?: string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO';
    createdAt: string;
    updatedAt: string;
    userId: string;
    locationId: string;
    eventId?: string;
    user: {
        id: string;
        username: string;
    };
    location: Location;
    event?: Event;
}

export interface EventAttendance {
    id: string;
    eventId: string;
    userId: string;
    role: ParticipantRole;
    joinedAt: string;
    leftAt?: string;
    isActive: boolean;
    lastLocationCheck?: string;
    user?: {
        id: string;
        username: string;
        role?: 'STUDENT' | 'FACULTY' | 'ADMIN';
    };
    event?: Event;
}

export interface EventStatusUpdate {
    eventId: string;
    isLive: boolean;
    status?: status;
}

export interface LocationBound {
    id: string;
    eventId: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
}

export interface ModeratorToken {
    id: string;
    token: string;
    createdById: string;
    isUsed: boolean;
    usedByUserId?: string;
    expiresAt: string;
    createdAt: string;
}

export interface UserAppRole {
    id: string;
    userId: string;
    roleType: ParticipantRole;
    moderatorTokenId?: string;
    createdAt: string;
    expiresAt?: string;
}

// Socket event types
export interface SocketEvents {
    // Client to server events
    'joinLocation': (locationId: string) => void;
    'leaveLocation': (locationId: string) => void;
    'joinEvent': (eventId: string) => void;
    'leaveEvent': (eventId: string) => void;
    'join-event-attendance': (eventId: string, callback: (response: AttendanceResponse) => void) => void;
    'leave-event-attendance': (eventId: string, callback: (response: AttendanceResponse) => void) => void;
    'eventMessage': (data: { eventId: string; message: string; timestamp: string }) => void;
    'typing': (data: { eventId: string; isTyping: boolean }) => void;
    'post-to-event': (data: {
        eventId: string;
        content?: string;
        mediaUrl?: string;
        locationId: string;
    }, callback: (response: PostResponse) => void) => void;
    'join-event-with-role': (data: {
        eventId: string;
        role: ParticipantRole;
        latitude?: number;
        longitude?: number;
    }, callback: (response: AttendanceResponse) => void) => void;
    'leave-event-role': (eventId: string, callback: (response: AttendanceResponse) => void) => void;
    'moderator-end-event': (eventId: string, callback: (response: { success: boolean; message: string }) => void) => void;
    'update-location': (data: {
        eventId: string;
        latitude: number;
        longitude: number;
    }, callback: (response: {
        success: boolean;
        distance?: number;
        maxDistance?: number;
        status?: 'valid' | 'warning';
        message?: string;
    }) => void) => void;
    'set-event-bounds': (data: {
        eventId: string;
        centerLat: number;
        centerLng: number;
        radiusMeters: number;
    }, callback: (response: {
        success: boolean;
        message: string;
        bounds?: LocationBound;
    }) => void) => void;

    // Server to client events
    'newPost': (post: Post) => void;
    'eventUpdate': (update: Event) => void;
    'locationEventUpdate': (update: Location) => void;
    'newEventMessage': (data: {
        eventId: string;
        message: string;
        timestamp: string;
        user: { id: string; username: string };
    }) => void;
    'userTyping': (data: {
        userId: string;
        username: string;
        isTyping: boolean;
    }) => void;
    'user-joined-event': (data: {
        userId: string;
        username?: string;
        attendance: EventAttendance;
        timestamp: string;
    }) => void;
    'user-left-event': (data: {
        userId: string;
        username?: string;
        timestamp: string;
    }) => void;
    'attendance-updated': (data: {
        eventId: string;
        attendeeCount: number;
        attendees?: Array<{
            id: string;
            username: string;
            joinedAt: string;
        }>;
    }) => void;
    'event-ended': (data: {
        eventId: string;
        message: string;
        timestamp: string;
    }) => void;
    'event-status-changed': (data: {
        eventId: string;
        status: status;
        timestamp: string;
    }) => void;
    'new-event-post': (data: {
        eventId: string;
        timestamp: string;
    }) => void;
    'user-joined-with-role': (data: {
        userId: string;
        username: string;
        role: ParticipantRole;
        timestamp: string;
    }) => void;
    'user-left-event-role': (data: {
        userId: string;
        username: string;
        timestamp: string;
    }) => void;
    'event-ended-by-moderator': (data: {
        eventId: string;
        endedBy: string;
        timestamp: string;
    }) => void;
    'location-warning': (data: {
        distance: number;
        maxDistance: number;
        message: string;
    }) => void;
    'user-removed-location': (data: {
        userId: string;
        username: string;
        reason: 'location';
        timestamp: string;
    }) => void;
    'bounds-updated': (data: {
        eventId: string;
        bounds: LocationBound;
        updatedBy: string;
        timestamp: string;
    }) => void;
    'removed-from-event': (data: {
        reason: string;
        eventId: string;
        message: string;
    }) => void;
    'event-force-ended': (data: {
        eventId: string;
        message: string;
        timestamp: string;
    }) => void;
    'role-specific-update': (data: {
        targetRole: ParticipantRole;
        message: string;
        data: Record<string, unknown>;
        timestamp: string;
    }) => void;
}

export interface AttendanceResponse {
    success: boolean;
    message: string;
    attendance?: EventAttendance;
}

export interface PostResponse {
    success: boolean;
    message: string;
    post?: Post;
}

// API Request/Response types
export interface CreateEventRequest {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    locationId: string;
    maxAttendees?: number;

    // Advanced options
    isPrivate?: boolean;
    isRecurring?: boolean;
    recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    recurrenceEndDate?: string;
}

export interface UpdateEventRequest {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}

export interface CreateLocationRequest {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    category: string;
}

export interface CreatePostRequest {
    content?: string;
    locationId: string;
    eventId?: string;
    media?: File;
}

// Map-related types
export interface MapPin {
    id: string;
    position: [number, number]; // [lat, lng]
    location: Location;
    hasLiveEvent: boolean;
    eventCount: number;
    recentPosts: Post[];
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

// Authentication types
export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    username: string;
    password: string;
    role?: 'STUDENT' | 'FACULTY';
}

export interface AuthResponse {
    success: boolean;
    message: string;
    token?: string;
    user?: User;
}

// Component prop types
export interface LocationPinProps {
    location: Location;
    hasLiveEvent: boolean;
    onClick: (location: Location) => void;
    isSelected?: boolean;
}

export interface EventModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onJoinEvent: (eventId: string) => void;
    onLeaveEvent: (eventId: string) => void;
    currentUser: User | null;
}

export interface MediaUploadProps {
    onUpload: (file: File) => void;
    acceptedTypes: string[];
    maxSize: number;
    disabled?: boolean;
}

// Store state types
export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface MapState {
    locations: Location[];
    selectedLocation: Location | null;
    events: Event[];
    selectedEvent: Event | null;
    userLocation: [number, number] | null;
    isLoading: boolean;
}

export interface SocketState {
    isConnected: boolean;
    error: string | null;
    reconnectAttempts: number;
}

// API Error types
export interface ApiError {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
}

// Admin Types
export interface SystemStats {
    users: {
        total: number;
        admins: number;
        faculty: number;
        students: number;
    };
    events: {
        total: number;
        live: number;
        upcoming: number;
        ended: number;
    };
    moderators: {
        active: number;
        tokens: {
            total: number;
            used: number;
            available: number;
            expired: number;
        };
    };
    content: {
        totalPosts: number;
        postsToday: number;
    };
}

export interface UserWithStats extends User {
    stats: {
        eventsOrganized: number;
        postsCreated: number;
        eventsAttended: number;
    };
}

export interface EventAnalytics extends Event {
    analytics: {
        totalParticipants: number;
        currentParticipants: number;
        totalPosts: number;
        participantsByRole: {
            moderators: number;
            posters: number;
            watchers: number;
        };
        averageAttendanceDuration: number;
    };
}

// Battery API types
export interface BatteryManager {
    readonly level: number;
    readonly charging: boolean;
    readonly chargingTime: number;
    readonly dischargingTime: number;
}

export interface NavigatorBattery {
    getBattery(): Promise<BatteryManager>;
}

// Media Upload Types
export interface MediaUploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface MediaCompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

export interface LocationCache {
    position: GeolocationPosition;
    timestamp: number;
    accuracy: number;
}

export interface BackgroundTrackingOptions {
    enabled: boolean;
    updateInterval: number;
    batteryOptimization: boolean;
}