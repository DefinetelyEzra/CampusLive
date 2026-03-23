import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { MapPin, Users, Clock } from 'lucide-react';
import L from 'leaflet';
import type { Event } from '../../types';

interface EventMarkerProps {
    event: Event;
    onClick: (eventId: string) => void;
}

const EventMarker: React.FC<EventMarkerProps> = ({ event, onClick }) => {
    const createEventIcon = (isLive: boolean, attendeeCount: number) => {
        const color = isLive ? '#10b981' : '#6b7280';
        const pulseAnimation = isLive ? 'animate-pulse' : '';

        // Extract attendee badge logic
        const getAttendeeBadge = () => {
            if (attendeeCount > 0) {
                const displayCount = attendeeCount > 9 ? '9+' : attendeeCount;
                return `
          <div class="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold border-2 border-white">
            ${displayCount}
          </div>
        `;
            }
            return '';
        };

        return L.divIcon({
            html: `
        <div class="relative">
          <div class="w-8 h-8 ${pulseAnimation} bg-white border-3 rounded-full shadow-lg flex items-center justify-center" style="border-color: ${color};">
            <div class="w-4 h-4 rounded-full" style="background-color: ${color};"></div>
          </div>
          ${getAttendeeBadge()}
        </div>
      `,
            className: 'custom-event-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Marker
            position={[
                event.location.latitude || 6.4865,
                event.location.longitude || 3.856059
            ]}
            icon={createEventIcon(event.isLive, event.attendeeCount || 0)}
            eventHandlers={{
                click: () => onClick(event.id)
            }}
        >
            <Popup>
                <div className="min-w-[200px] max-w-[250px]">
                    <div className="mb-3">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">{event.title}</h3>
                        {event.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">{event.description}</p>
                        )}
                    </div>

                    <div className="space-y-2 mb-3">
                        <div className="flex items-center text-xs text-gray-600">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span>{event.location.name}</span>
                        </div>

                        <div className="flex items-center text-xs text-gray-600">
                            <Users className="w-3 h-3 mr-1" />
                            <span>{event.attendeeCount || 0} participant{(event.attendeeCount || 0) === 1 ? '' : 's'}</span>
                        </div>

                        <div className="flex items-center text-xs text-gray-600">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>Started: {formatTime(event.startTime)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.isLive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}>
                            {event.isLive ? 'LIVE' : 'ENDED'}
                        </span>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick(event.id);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};

export default EventMarker;