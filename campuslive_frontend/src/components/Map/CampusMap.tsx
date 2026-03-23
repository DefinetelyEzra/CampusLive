import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useAuthStore } from '../../stores/authStore';
import { useSocketStore } from '../../stores/socketStore';
import { useRoleStore } from '../../stores/roleStore';
import { useToast } from '../toastContext';
import { LogOut, Users, Camera, Eye, Search, Shield } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RoleStatusIndicator from '../User/RoleStatusIndicator';
import EventDetailsModal from '../Events/EventDetailsModal';
import type { Event, EventStatusUpdate } from '../../types';
import apiService from '../../services/api';
import { LocationService } from '../../services/locationService';

// Constants
const PAU_CENTER: [number, number] = [6.4865, 3.856059];
const MAP_CONFIG = {
    INITIAL_ZOOM: 17,
    MIN_ZOOM: 15,
    MAX_ZOOM: 19,
    REFRESH_INTERVAL: 30000, // 30 seconds
    GEOLOCATION_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Changed from 5000
    }
} as const;

const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
    [6.48, 3.85],
    [6.493, 3.862]
];

const ROLE_COLORS = {
    MODERATOR: '#dc2626',
    POSTER: '#ea580c',
    WATCHER: '#2563eb',
    DEFAULT_LIVE: '#10b981',
    DEFAULT_ENDED: '#6b7280'
} as const;

// Types
interface EventActionData { eventId: string; }
interface LocationWarning { message: string; maxDistance?: number; distance?: number; }
interface UserAttendance { eventId: string; role: string; }

// Utility functions
const createEventIcon = (status: 'live' | 'ended', hasMedia: boolean, userRole?: string): L.DivIcon => {
    let color: '#10b981' | '#6b7280' = status === 'live' ? ROLE_COLORS.DEFAULT_LIVE : ROLE_COLORS.DEFAULT_ENDED;

    if (userRole && userRole in ROLE_COLORS) {
        color = ROLE_COLORS[userRole as keyof typeof ROLE_COLORS] as '#10b981' | '#6b7280';
    }

    const pulseClass = status === 'live' ? 'animate-pulse' : '';
    const mediaIndicator = hasMedia
        ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white"></div>'
        : '';

    return L.divIcon({
        html: `
      <div class="relative">
        <div class="w-6 h-6 ${pulseClass} bg-white rounded-full shadow-lg flex items-center justify-center" style="border:2px solid ${color}">
          <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
        </div>
        ${mediaIndicator}
      </div>
    `,
        className: 'custom-event-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const createUserLocationIcon = (): L.DivIcon => L.divIcon({
    html: '<div class="w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>',
    className: 'user-location-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const CampusMap: React.FC = () => {
    // Store hooks
    const { user, logout } = useAuthStore();
    const { socket, connectSocket } = useSocketStore();
    const { currentRole } = useRoleStore();
    const { showToast } = useToast();

    // State
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [showEventModal, setShowEventModal] = useState<boolean>(false);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [userAttendances, setUserAttendances] = useState<UserAttendance[]>([]);
    const [isWithinCampus, setIsWithinCampus] = useState<boolean>(true);
    const [boundsMessage, setBoundsMessage] = useState<string>('');

    // Refs for cleanup and preventing infinite loops
    const locationWatchIdRef = useRef<number | undefined>(undefined);
    const refreshIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Memoized values
    const isAdmin = useMemo(() => user?.role === 'ADMIN', [user?.role]);

    const filteredEvents = useMemo(() =>
        events.filter(event =>
            event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.location?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [events, searchQuery]
    );

    // Data loading functions
    const loadEvents = useCallback(async () => {
        try {
            const allEvents = await apiService.getAllEvents();
            const liveEvents = allEvents.filter(event => event.isLive);
            setEvents(liveEvents);
            console.log(`Loaded ${liveEvents.length} live events at ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            console.error('Failed to load events:', error);
        }
    }, []);

    const loadUserAttendance = useCallback(async () => {
        try {
            const response = await apiService.getMyAttendances();
            if (response?.success && response.data) {
                setUserAttendances(
                    response.data.map((attendance) => ({
                        eventId: attendance.eventId,
                        role: attendance.role
                    }))
                );
            } else {
                setUserAttendances([]);
            }
        } catch (error) {
            console.error('Failed to load user attendances:', error);
            setUserAttendances([]);
        }
    }, []);

    // Geolocation handlers
    const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
        const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
        ];
        console.log(`Position update - Lat: ${location[0].toFixed(6)}, Lng: ${location[1].toFixed(6)}, Accuracy: ${position.coords.accuracy.toFixed(2)}m`);

        // Check if within campus bounds
        const [minLat, minLng] = CAMPUS_BOUNDS[0];
        const [maxLat, maxLng] = CAMPUS_BOUNDS[1];

        const withinBounds =
            location[0] >= minLat &&
            location[0] <= maxLat &&
            location[1] >= minLng &&
            location[1] <= maxLng;

        setIsWithinCampus(withinBounds);

        if (withinBounds) {
            if (!isWithinCampus && boundsMessage) {
                showToast('Welcome back to campus!', 'success');
            }
            setBoundsMessage('');
            setUserLocation(location);
        } else {
            setBoundsMessage('You are outside Pan-Atlantic University campus bounds');
            if (isWithinCampus) {
                showToast('You are outside campus bounds');
            }
            setUserLocation(null);
        }

        // Send location updates to backend if user is in an event and not a watcher
        if (socket && withinBounds && currentRole?.roleType !== 'WATCHER' && userAttendances.length > 0) {
            for (const attendance of userAttendances) {
                socket.emit('update-location', {
                    eventId: attendance.eventId,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }, (response: { success?: boolean; skipped?: boolean; reason?: string; message?: string }) => {
                    if (response?.skipped) {
                        console.log(`Location update skipped: ${response.reason}`);
                    }
                });
            }
        }
    }, [socket, currentRole, userAttendances, showToast, isWithinCampus, boundsMessage]);

    const handlePositionError = useCallback((error: GeolocationPositionError) => {
        const errorMessages: { [key in typeof error.code]: string } = {
            [error.PERMISSION_DENIED]: 'Geolocation permission denied by user',
            [error.POSITION_UNAVAILABLE]: 'Location information unavailable',
            [error.TIMEOUT]: 'Location request timed out'
        };
        const message = errorMessages[error.code] || 'Unknown geolocation error';
        console.log(message);
        showToast(message, 'error');
    }, [showToast]);

    // Location tracking
const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation || locationWatchIdRef.current !== undefined) {
        return;
    }

    const watchPosition = () => {
        const watchId = LocationService.watchPosition(
            handlePositionUpdate,
            handlePositionError
        );
        locationWatchIdRef.current = watchId;
    };

    if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state !== 'denied') {
                watchPosition();
            }
        }).catch(() => watchPosition());
    } else {
        watchPosition();
    }
}, [handlePositionUpdate, handlePositionError]);

const stopLocationTracking = useCallback(() => {
    if (locationWatchIdRef.current !== undefined) {
        LocationService.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = undefined;
    }
}, []);

    // Socket event handlers
    const handleEventUpdate = useCallback((update: EventStatusUpdate) => {
        setEvents(prev => {
            const updatedEvents = prev.map(evt =>
                evt.id === update.eventId
                    ? {
                        ...evt,
                        isLive: update.isLive,
                        status: update.status || (update.isLive ? 'LIVE' : 'ENDED')
                    }
                    : evt
            );
            return updatedEvents.filter(evt => evt.isLive);
        });

        // Delayed refresh for consistency
        setTimeout(loadEvents, 1000);
    }, [loadEvents]);

    const handleEventEnded = useCallback((data: EventActionData) => {
        setEvents(prev => prev.filter(evt => evt.id !== data.eventId));
    }, []);

    const handleEventDeleted = useCallback((data: EventActionData) => {
        setEvents(prev => prev.filter(evt => evt.id !== data.eventId));
    }, []);

    const handleLocationWarning = useCallback((warning: LocationWarning) => {
        showToast(`Location Warning: ${warning.message}`, 'error');
    }, [showToast]);

    const handleRemovedFromEvent = useCallback((data: { reason?: string }) => {
        showToast(`You were removed from the event: ${data.reason ?? 'No reason provided'}`, 'error');
    }, [showToast]);

    const handleUserJoinedEvent = useCallback((data: { userId: string; eventId: string; role: string }) => {
        if (data.userId === user?.id) {
            setUserAttendances(prev => {
                // Check if already attending
                if (prev.some(a => a.eventId === data.eventId)) {
                    return prev;
                }
                return [...prev, { eventId: data.eventId, role: data.role }];
            });
            loadEvents();
        }
    }, [user?.id, loadEvents]);

    const handleUserLeftEvent = useCallback((data: { userId: string; eventId: string }) => {
        if (data.userId === user?.id) {
            setUserAttendances(prev => prev.filter(a => a.eventId !== data.eventId));
            loadEvents();
        }
    }, [user?.id, loadEvents]);

    // Event handlers
    const handleEventMarkerClick = useCallback(async (eventId: string) => {
        try {
            const event = await apiService.getEventById(eventId);
            setSelectedEvent(event);
            setShowEventModal(true);
        } catch (error) {
            console.error('Failed to load event details:', error);
            showToast('Failed to load event details', 'error');
        }
    }, [showToast]);

    const handleRefreshEvents = useCallback(() => {
        loadEvents();
        loadUserAttendance();
    }, [loadEvents, loadUserAttendance]);

    // Effects
    useEffect(() => {
        loadUserAttendance();
    }, [loadUserAttendance]);

    // Initialize socket and load data
    useEffect(() => {
        if (!socket) {
            connectSocket();
        }
        loadEvents();
    }, [socket, connectSocket, loadEvents]);

    // Handle event selection from notifications
    useEffect(() => {
        const handleSelectEvent = async (e: globalThis.Event) => {
            // Type guard to ensure it's a CustomEvent with string detail
            if (!(e instanceof CustomEvent) || typeof e.detail !== 'string') {
                console.warn('Received invalid selectEvent:', e);
                return;
            }

            const eventId = e.detail;
            try {
                const event = await apiService.getEventById(eventId);
                setSelectedEvent(event);
                setShowEventModal(true);
            } catch (error) {
                console.error('Failed to load event:', error);
                showToast('Failed to load event details', 'error');
            }
        };

        globalThis.addEventListener('selectEvent', handleSelectEvent);

        return () => {
            globalThis.removeEventListener('selectEvent', handleSelectEvent);
        };
    }, [showToast]);

    // Periodic refresh
    useEffect(() => {
        const refreshEvents = () => {
            console.log('Auto-refreshing events...');
            handleRefreshEvents();
        };

        refreshIntervalRef.current = globalThis.setInterval(refreshEvents, MAP_CONFIG.REFRESH_INTERVAL);

        // cleanup 
        if (refreshIntervalRef.current !== undefined) {
            globalThis.clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = undefined;
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [handleRefreshEvents]);

    // Location tracking based on role
    useEffect(() => {
        if (currentRole && currentRole.roleType !== 'WATCHER') {
            startLocationTracking();
        } else {
            stopLocationTracking();
        }

        return stopLocationTracking;
    }, [currentRole, startLocationTracking, stopLocationTracking]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const socketEvents = {
            'eventStatusUpdate': handleEventUpdate,
            'eventEnded': handleEventEnded,
            'eventDeleted': handleEventDeleted,
            'location-warning': handleLocationWarning,
            'removed-from-event': handleRemovedFromEvent,
            'user-joined-event': handleUserJoinedEvent,
            'user-left-event': handleUserLeftEvent
        };

        // Register listeners
        for (const [event, handler] of Object.entries(socketEvents)) {
            socket.on(event, handler);
        }

        // Cleanup listeners
        return () => {
            for (const [event, handler] of Object.entries(socketEvents)) {
                socket.off(event, handler);
            }
        };
    }, [socket, handleEventUpdate, handleEventEnded, handleEventDeleted,
        handleLocationWarning, handleRemovedFromEvent, handleUserJoinedEvent, handleUserLeftEvent]);

    // Custom event listener for refresh
    useEffect(() => {
        globalThis.addEventListener('refreshEvents', handleRefreshEvents);
        return () => globalThis.removeEventListener('refreshEvents', handleRefreshEvents);
    }, [handleRefreshEvents]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopLocationTracking();
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [stopLocationTracking]);

    // Render helpers
    const renderEventMarkers = () => (
        filteredEvents.map(evt => {
            const { latitude: lat, longitude: lng } = evt.location;

            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                console.warn(`Invalid coordinates for event ${evt.title}: lat=${lat}, lng=${lng}`);
                return null;
            }

            const hasMedia = (evt.posts?.length ?? 0) > 0;
            const attendance = userAttendances.find(a => a.eventId === evt.id);
            const userRole = attendance?.role;

            return (
                <Marker
                    key={evt.id}
                    position={[lat, lng]}
                    icon={createEventIcon(evt.isLive ? 'live' : 'ended', hasMedia, userRole)}
                    eventHandlers={{ click: () => void handleEventMarkerClick(evt.id) }}
                >
                    <Popup>
                        <div className="text-center">
                            <h3 className="font-bold">{evt.title}</h3>
                            <p className="text-sm text-gray-600">{evt.location?.name}</p>
                            <div className="flex items-center justify-center mt-2 space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${evt.isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {evt.isLive ? 'LIVE' : 'ENDED'}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {evt.attendeeCount ?? 0} attending
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            );
        })
    );

    const renderUserLocationMarker = () => {
        if (!userLocation || !isWithinCampus) return null;

        return (
            <Marker position={userLocation} icon={createUserLocationIcon()}>
                <Popup>
                    <div className="text-center">
                        <p className="font-medium">Your Location</p>
                        <p className="text-xs text-gray-600">{user?.username}</p>
                        <p className="text-xs text-green-600 mt-1">✓ Within campus bounds</p>
                    </div>
                </Popup>
            </Marker>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-[1000] bg-gradient-to-r from-white to-gray-100 text-gray-800 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-28">
                        {/* Brand */}
                        <div className="flex items-center space-x-4">
                            <img src="/src/assets/logo.png" alt="CampusLive Logo" className="h-16 w-16" />
                            <div>
                                <h1 className="text-3xl font-extrabold leading-6 text-gray-900">CampusLive</h1>
                                <p className="text-base text-gray-600">Pan-Atlantic University</p>
                            </div>
                        </div>

                        {/* Search */}
                        <div className={`hidden md:flex md:items-center ${isAdmin ? 'md:w-1/4' : 'md:w-1/3'}`}>
                            <div className="w-full relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search events or locations..."
                                    className={`pl-10 pr-4 py-2 w-full rounded-xl bg-gray-100 text-gray-800 placeholder-gray-500 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isAdmin ? 'text-sm' : 'text-base'}`}
                                />
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center space-x-3">
                            <div className="hidden md:flex items-center space-x-3">
                                {/* Only show role indicator if NOT a moderator */}
                                {currentRole?.roleType !== 'MODERATOR' && <RoleStatusIndicator />}

                                {isAdmin && (
                                    <button
                                        onClick={() => (globalThis.location.href = '/admin')}
                                        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-2xl bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
                                    >
                                        <span>Admin Panel</span>
                                    </button>
                                )}

                                {/* Moderator Panel */}
                                {currentRole?.roleType === 'MODERATOR' && (
                                    <button
                                        onClick={() => (globalThis.location.href = '/moderator')}
                                        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-2xl bg-purple-100 hover:bg-purple-200 text-purple-700 transition whitespace-nowrap"
                                    >
                                        <Shield className="h-4 w-4" />
                                        <span>Moderator Panel</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => (globalThis.location.href = '/roles')}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                                >
                                    <Users className="h-4 w-4" />
                                    <span>Roles</span>
                                </button>

                                <button
                                    onClick={logout}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-2xl bg-red-100 hover:bg-red-200 text-red-700 transition"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Logout</span>
                                </button>

                                <div className="flex items-center space-x-2">
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
                                        {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <p className="font-medium">{user?.username}</p>
                                        <p className="text-xs text-gray-500">{user?.role}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile menu button */}
                            <div className="md:hidden">
                                <button
                                    onClick={() => setMobileMenuOpen(prev => !prev)}
                                    aria-label="Toggle menu"
                                    className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                                >
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {mobileMenuOpen ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden mt-3 pb-4 border-t border-gray-200">
                            <div className="space-y-3 pt-3">
                                <div className="px-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search events or locations..."
                                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-500 border border-gray-200"
                                        />
                                    </div>
                                </div>

                                <div className="px-2 flex flex-col space-y-2">
                                    {isAdmin && (
                                        <button onClick={() => (globalThis.location.href = '/admin')} className="w-full text-left px-3 py-2 rounded-lg bg-blue-100 text-blue-700">
                                            Admin Panel
                                        </button>
                                    )}
                                    {currentRole?.roleType === 'MODERATOR' && (
                                        <button
                                            onClick={() => (globalThis.location.href = '/moderator')}
                                            className="w-full text-left px-3 py-2 rounded-lg bg-purple-100 text-purple-700 flex items-center space-x-2"
                                        >
                                            <Shield className="h-4 w-4" />
                                            <span>Moderator Panel</span>
                                        </button>
                                    )}
                                    <button onClick={() => (globalThis.location.href = '/roles')} className="w-full text-left px-3 py-2 rounded-lg bg-gray-100 text-gray-700">
                                        Roles
                                    </button>
                                    <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg bg-red-100 text-red-700">
                                        Logout
                                    </button>
                                </div>

                                <div className="px-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
                                            {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{user?.username}</p>
                                            <p className="text-xs text-gray-500">{user?.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    <div className="mb-6 text-center">
                        <img src="/src/assets/logo.png" alt="CampusLive Logo" className="h-20 w-20 mx-auto mb-3" />
                        <h2 className="text-3xl font-bold text-gray-900 mb-1">CampusLive Map</h2>
                        <p className="text-gray-600">Interactive campus map showing live events and activities</p>
                    </div>

                    {/* Campus Bounds Warning */}
                    {!isWithinCampus && boundsMessage && (
                        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg shadow-sm">
                            <div className="flex items-center space-x-3">
                                <svg className="h-6 w-6 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-yellow-800">{boundsMessage}</p>
                                    <p className="text-xs text-yellow-700 mt-1">Enable location and/or return to campus to see your position on the map</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Map */}
                    <div className="mb-8 rounded-lg overflow-hidden shadow-lg h-[50vh] sm:h-[60vh] md:h-[600px] mt-4 relative z-0">
                        <MapContainer
                            center={PAU_CENTER}
                            zoom={MAP_CONFIG.INITIAL_ZOOM}
                            minZoom={MAP_CONFIG.MIN_ZOOM}
                            maxZoom={MAP_CONFIG.MAX_ZOOM}
                            maxBounds={CAMPUS_BOUNDS}
                            maxBoundsViscosity={1}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                            scrollWheelZoom={true}
                            doubleClickZoom={true}
                            dragging={true}
                            className="leaflet-container"
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                maxZoom={19}
                            />
                            {renderEventMarkers()}
                            {renderUserLocationMarker()}
                        </MapContainer>
                    </div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-white hover:scale-105 transform transition shadow-md">
                            <div className="h-14 w-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Eye className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-lg text-center">Watch Events</h3>
                            <p className="text-sm text-gray-600 text-center">View live events and media streams from across campus</p>
                        </div>

                        <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-white hover:scale-105 transform transition shadow-md">
                            <div className="h-14 w-14 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Camera className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-lg text-center">Post Content</h3>
                            <p className="text-sm text-gray-600 text-center">Share photos and videos from live events you're attending</p>
                        </div>

                        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-white hover:scale-105 transform transition shadow-md">
                            <div className="h-14 w-14 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Users className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-lg text-center">Moderate Events</h3>
                            <p className="text-sm text-gray-600 text-center">Control event boundaries and manage participants</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Event Details Modal */}
            {showEventModal && selectedEvent && (
                <EventDetailsModal
                    event={selectedEvent}
                    onClose={() => setShowEventModal(false)}
                />
            )}

            {/* Styles */}
            <style>{`
        .leaflet-container { font-family: inherit; position: relative; z-index: 1; }
        .leaflet-control-zoom { border-radius: 8px; box-shadow: 0 4px 10px rgba(2,6,23,0.12); }
        .custom-event-marker { background: transparent !important; border: none !important; }
        .user-location-marker { background: transparent !important; border: none !important; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }

        .leaflet-popup-content { font-size: 14px; }
        .leaflet-container { z-index: 1; }
        header { z-index: 1000; }

        @media (max-width: 640px) {
          .leaflet-container { 
            font-size: 14px; 
            position: relative;
            z-index: 1;
          }
          header {
            position: sticky;
            top: 0;
            z-index: 1000;
          }
        }
      `}</style>
        </div>
    );
};

export default CampusMap;