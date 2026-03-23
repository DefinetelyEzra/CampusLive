import { useEffect, useState, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService';
import { useSocketStore } from '../stores/socketStore';

interface EventLiveNotification {
    eventId: string;
    title: string;
    locationName: string;
    timestamp: string;
}

interface UseNotificationsReturn {
    notifications: EventLiveNotification[];
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
    dismissNotification: (eventId: string) => void;
    clearAllNotifications: () => void;
}

// Helper functions to reduce nesting
const addNotificationToState = (
    data: EventLiveNotification,
    setNotifications: React.Dispatch<React.SetStateAction<EventLiveNotification[]>>
) => {
    setNotifications(prev => {
        // Prevent duplicates in state
        if (prev.some(n => n.eventId === data.eventId)) {
            return prev;
        }
        return [data, ...prev];
    });
};

const scheduleAutoDismiss = (
    eventId: string,
    setNotifications: React.Dispatch<React.SetStateAction<EventLiveNotification[]>>
) => {
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.eventId !== eventId));
    }, 15000);
};

const createEventLiveHandler = (
    processedEventsRef: React.RefObject<Set<string>>,
    setNotifications: React.Dispatch<React.SetStateAction<EventLiveNotification[]>>
) => {
    return (data: EventLiveNotification) => {
        console.log('Received event:live notification:', data);

        // Prevent duplicate notifications for the same event
        if (processedEventsRef.current?.has(data.eventId)) {
            console.log('Event already notified, skipping:', data.eventId);
            return;
        }

        // Mark as processed
        processedEventsRef.current?.add(data.eventId);

        // Show browser notification
        notificationService.showEventLiveNotification(data);

        // Add to in-app notification list
        addNotificationToState(data, setNotifications);

        // Auto-dismiss after 15 seconds
        scheduleAutoDismiss(data.eventId, setNotifications);
    };
};

export const useNotifications = (): UseNotificationsReturn => {
    const { socket } = useSocketStore();
    const [notifications, setNotifications] = useState<EventLiveNotification[]>([]);
    const [hasPermission, setHasPermission] = useState(false);
    const processedEventsRef = useRef<Set<string>>(new Set());

    // Check initial permission status
    useEffect(() => {
        const checkPermission = () => {
            const permission = notificationService.getPermission();
            setHasPermission(permission === 'granted');
        };

        checkPermission();
        // Re-check when window regains focus (user may have changed permissions)
        window.addEventListener('focus', checkPermission);

        return () => window.removeEventListener('focus', checkPermission);
    }, []);

    // Request notification permission
    const requestPermission = useCallback(async (): Promise<boolean> => {
        const granted = await notificationService.requestPermission();
        setHasPermission(granted);
        return granted;
    }, []);

    // Dismiss a specific notification
    const dismissNotification = useCallback((eventId: string) => {
        setNotifications(prev => prev.filter(n => n.eventId !== eventId));
    }, []);

    // Clear all notifications
    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Handle event:live socket event
    useEffect(() => {
        if (!socket) return;

        const handleEventLive = createEventLiveHandler(processedEventsRef, setNotifications);
        socket.on('event:live', handleEventLive);

        return () => {
            socket.off('event:live', handleEventLive);
        };
    }, [socket]);

    // Clean up processed events periodically (prevent memory leak)
    useEffect(() => {
        const cleanupProcessedEvents = () => {
            // Keep only last 50 event IDs in memory
            if (processedEventsRef.current.size > 50) {
                const entries = Array.from(processedEventsRef.current);
                processedEventsRef.current = new Set(entries.slice(-50));
            }
        };

        const interval = setInterval(cleanupProcessedEvents, 60000); // Every minute
        return () => clearInterval(interval);
    }, []);

    return {
        notifications,
        hasPermission,
        requestPermission,
        dismissNotification,
        clearAllNotifications,
    };
};