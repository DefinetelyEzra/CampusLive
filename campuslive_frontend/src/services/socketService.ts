import { io, Socket } from 'socket.io-client';
import type { AttendanceResponse, PostResponse, Post, Event, Location, EventAttendance } from '../types';

class SocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectDelay = 1000;

    connect(token: string) {
        if (this.socket?.connected) {
            return;
        }

        this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
            auth: { token },
            transports: ['websocket', 'polling'],
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
        });

        this.setupEventListeners();
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    private setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.reconnectAttempts++;
        });

        // Debug all incoming events
        this.socket.onAny((event, ...args) => {
            console.log(`Received socket event: ${event}`, args);
        });
    }

    // Location room management
    joinLocationRoom(locationId: string) {
        this.socket?.emit('joinLocation', locationId);
    }

    leaveLocationRoom(locationId: string) {
        this.socket?.emit('leaveLocation', locationId);
    }

    // Event room management
    joinEventRoom(eventId: string) {
        this.socket?.emit('joinEvent', eventId);
    }

    leaveEventRoom(eventId: string) {
        this.socket?.emit('leaveEvent', eventId);
    }

    // Event attendance via socket
    joinEventAttendance(eventId: string): Promise<AttendanceResponse> {
        return new Promise((resolve) => {
            this.socket?.emit('join-event-attendance', eventId, (response: AttendanceResponse) => {
                resolve(response);
            });
        });
    }

    leaveEventAttendance(eventId: string): Promise<AttendanceResponse> {
        return new Promise((resolve) => {
            this.socket?.emit('leave-event-attendance', eventId, (response: AttendanceResponse) => {
                resolve(response);
            });
        });
    }

    // Real-time posting
    postToEvent(data: {
        eventId: string;
        content?: string;
        mediaUrl?: string;
        locationId: string;
    }): Promise<PostResponse> {
        return new Promise((resolve) => {
            this.socket?.emit('post-to-event', data, (response: PostResponse) => {
                resolve(response);
            });
        });
    }

    // Event messaging
    sendEventMessage(eventId: string, message: string) {
        this.socket?.emit('eventMessage', {
            eventId,
            message,
            timestamp: new Date().toISOString(),
        });
    }

    // Typing indicators
    setTyping(eventId: string, isTyping: boolean) {
        this.socket?.emit('typing', { eventId, isTyping });
    }

    // Event listeners
    onNewPost(callback: (post: Post) => void) {
        this.socket?.on('newPost', callback);
    }

    onEventUpdate(callback: (update: Event) => void) {
        this.socket?.on('eventUpdate', callback);
    }

    onLocationEventUpdate(callback: (update: Location) => void) {
        this.socket?.on('locationEventUpdate', callback);
    }

    // Listen for live event notifications
    onEventLive(callback: (data: {
        eventId: string;
        title: string;
        locationName: string;
        timestamp: string;
    }) => void) {
        this.socket?.on('event:live', callback);
    }

    onUserJoinedEvent(callback: (data: { userId: string; username?: string; attendance: EventAttendance; timestamp: string }) => void) {
        this.socket?.on('user-joined-event', callback);
    }

    onUserLeftEvent(callback: (data: { userId: string; username?: string; timestamp: string }) => void) {
        this.socket?.on('user-left-event', callback);
    }

    onAttendanceUpdated(callback: (data: { eventId: string; attendeeCount: number; attendees?: Array<{ id: string; username: string; joinedAt: string }> }) => void) {
        this.socket?.on('attendance-updated', callback);
    }

    onEventEnded(callback: (data: { eventId: string; message: string; timestamp: string }) => void) {
        this.socket?.on('event-ended', callback);
    }

    onEventStatusChanged(callback: (data: { eventId: string; status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED'; timestamp: string }) => void) {
        this.socket?.on('event-status-changed', callback);
    }

    onNewEventPost(callback: (data: { eventId: string; timestamp: string }) => void) {
        this.socket?.on('new-event-post', callback);
    }

    onNewEventMessage(callback: (data: { eventId: string; message: string; timestamp: string; user: { id: string; username: string } }) => void) {
        this.socket?.on('newEventMessage', callback);
    }

    onUserTyping(callback: (data: { userId: string; username: string; isTyping: boolean }) => void) {
        this.socket?.on('userTyping', callback);
    }

    // Cleanup listeners
    off(event: string, callback?: (...args: unknown[]) => void) {
        if (callback) {
            this.socket?.off(event, callback);
        } else {
            this.socket?.off(event);
        }
    }

    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    get socketId(): string | undefined {
        return this.socket?.id;
    }
}

export const socketService = new SocketService();