import React, { useEffect, useState } from 'react';
import { X, MapPin, Clock } from 'lucide-react';

interface EventLiveData {
    eventId: string;
    title: string;
    locationName: string;
    timestamp: string;
}

interface NotificationPopupProps {
    event: EventLiveData;
    onClose: () => void;
    onViewEvent?: (eventId: string) => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ event, onClose, onViewEvent }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [timeAgo, setTimeAgo] = useState('just now');

    useEffect(() => {
        // Trigger animation
        const showTimer = setTimeout(() => setIsVisible(true), 10);

        // Auto-close after 10 seconds
        const closeTimer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for animation
        }, 10000);

        // Update time ago every second
        const timeInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 1000);
            if (seconds < 5) {
                setTimeAgo('just now');
            } else if (seconds < 60) {
                setTimeAgo(`${seconds}s ago`);
            } else {
                const minutes = Math.floor(seconds / 60);
                setTimeAgo(`${minutes}m ago`);
            }
        }, 1000);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(closeTimer);
            clearInterval(timeInterval);
        };
    }, [event.timestamp, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation
    };

    const handleViewEvent = () => {
        if (onViewEvent) {
            onViewEvent(event.eventId);
        }
        handleClose();
    };

    return (
        <div
            className={`fixed top-20 right-4 z-[2000] transition-all duration-300 transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                }`}
            style={{ maxWidth: '400px' }}
        >
            <div className="bg-white rounded-xl shadow-2xl border-2 border-red-500 overflow-hidden">
                {/* Animated top bar */}
                <div className="h-1 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 animate-pulse"></div>

                <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-600 font-bold text-sm uppercase tracking-wide">
                                Event Now Live
                            </span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600 transition"
                            aria-label="Close notification"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Event Details */}
                    <div className="space-y-2 mb-4">
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                            {event.title}
                        </h3>

                        <div className="flex items-center space-x-2 text-gray-600 text-sm">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{event.locationName}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-gray-500 text-xs">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span>{timeAgo}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                        <button
                            onClick={handleViewEvent}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition"
                        >
                            View Event
                        </button>
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationPopup;