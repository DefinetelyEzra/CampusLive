import { create } from 'zustand';
import type { Location, Event, MapState, Post } from '../types';
import { apiService } from '../services/api';
import { socketService } from '../services/socketService';

interface MapStore extends MapState {
    // Actions
    loadLocations: () => Promise<void>;
    loadEvents: (isLive?: boolean) => Promise<void>;
    selectLocation: (location: Location | null) => void;
    selectEvent: (event: Event | null) => void;
    setUserLocation: (coords: [number, number] | null) => void;

    // Real-time updates
    updateEventInList: (updatedEvent: Event) => void;
    addNewPost: (post: Post) => void;

    // Socket room management
    joinLocationRoom: (locationId: string) => void;
    leaveLocationRoom: (locationId: string) => void;
    joinEventRoom: (eventId: string) => void;
    leaveEventRoom: (eventId: string) => void;

    // Event attendance
    joinEvent: (eventId: string) => Promise<boolean>;
    leaveEvent: (eventId: string) => Promise<boolean>;

    // Initialize socket listeners
    initSocketListeners: () => void;
}

export const useMapStore = create<MapStore>((set, get) => ({
    locations: [],
    selectedLocation: null,
    events: [],
    selectedEvent: null,
    userLocation: null,
    isLoading: false,

    // Initialize socket listeners
    initSocketListeners: () => {
        const updateEventStatus = (state: MapStore, data: { eventId: string; status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED'; timestamp: string }) => ({
            events: state.events.map((event) =>
                event.id === data.eventId ? { ...event, status: data.status } : event
            ),
            selectedEvent: state.selectedEvent?.id === data.eventId
                ? { ...state.selectedEvent, status: data.status }
                : state.selectedEvent,
        });

        const updateAttendance = (state: MapStore, data: { eventId: string; attendeeCount: number; attendees?: Array<{ id: string; username: string; joinedAt: string }> }) => ({
            events: state.events.map((event) =>
                event.id === data.eventId
                    ? { ...event, attendeeCount: data.attendeeCount }
                    : event
            ),
            selectedEvent: state.selectedEvent?.id === data.eventId
                ? { ...state.selectedEvent, attendeeCount: data.attendeeCount }
                : state.selectedEvent,
        });

        socketService.onEventUpdate((updatedEvent: Event) => {
            get().updateEventInList(updatedEvent);
        });

        socketService.onEventStatusChanged((data: { eventId: string; status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED'; timestamp: string }) => {
            set((state) => updateEventStatus(state, data));
        });

        socketService.onAttendanceUpdated((data) => {
            set((state) => updateAttendance(state, data));
        });

        socketService.onNewPost((post: Post) => {
            get().addNewPost(post);
        });
    },
    loadLocations: async () => {
        set({ isLoading: true });
        try {
            const locations = await apiService.getAllLocations();
            set({ locations, isLoading: false });
            get().initSocketListeners();
        } catch (error) {
            console.error('Failed to load locations:', error);
            set({ isLoading: false });
        }
    },

    loadEvents: async (isLive?: boolean) => {
        set({ isLoading: true });
        try {
            const events = await apiService.getAllEvents(isLive);
            set({ events, isLoading: false });
        } catch (error) {
            console.error('Failed to load events:', error);
            set({ isLoading: false });
        }
    },

    selectLocation: (location: Location | null) => {
        set({ selectedLocation: location });

        // Join/leave location rooms for real-time updates
        const currentLocation = get().selectedLocation;
        if (currentLocation && currentLocation.id !== location?.id) {
            socketService.leaveLocationRoom(currentLocation.id);
        }
        if (location) {
            socketService.joinLocationRoom(location.id);
        }
    },

    selectEvent: (event: Event | null) => {
        set({ selectedEvent: event });

        // Join/leave event rooms
        const currentEvent = get().selectedEvent;
        if (currentEvent && currentEvent.id !== event?.id) {
            socketService.leaveEventRoom(currentEvent.id);
        }
        if (event) {
            socketService.joinEventRoom(event.id);
        }
    },

    setUserLocation: (coords: [number, number] | null) => {
        set({ userLocation: coords });
    },

    updateEventInList: (updatedEvent: Event) => {
        set((state) => ({
            events: state.events.map((event) =>
                event.id === updatedEvent.id ? updatedEvent : event
            ),
            selectedEvent: state.selectedEvent?.id === updatedEvent.id ? updatedEvent : state.selectedEvent,
        }));
    },

    addNewPost: (post: Post) => {
        set((state) => ({
            locations: state.locations.map((location) =>
                location.id === post.locationId
                    ? {
                        ...location,
                        posts: [post, ...(location.posts || [])].slice(0, 5), // Keep latest 5
                    }
                    : location
            ),
        }));
    },

    joinLocationRoom: (locationId: string) => {
        socketService.joinLocationRoom(locationId);
    },

    leaveLocationRoom: (locationId: string) => {
        socketService.leaveLocationRoom(locationId);
    },

    joinEventRoom: (eventId: string) => {
        socketService.joinEventRoom(eventId);
    },

    leaveEventRoom: (eventId: string) => {
        socketService.leaveEventRoom(eventId);
    },

    joinEvent: async (eventId: string) => {
        try {
            const response = await socketService.joinEventAttendance(eventId);
            if (response.success) {
                // Refresh events to update attendance status
                await get().loadEvents();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to join event:', error);
            return false;
        }
    },

    leaveEvent: async (eventId: string) => {
        try {
            const response = await socketService.leaveEventAttendance(eventId);
            if (response.success) {
                // Refresh events to update attendance status
                await get().loadEvents();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to leave event:', error);
            return false;
        }
    },
}));