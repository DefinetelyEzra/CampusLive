import React, { useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { Event } from '../../../types';
import { AdminFilters } from './AdminFilters';

interface EventsTableProps {
    events: Event[];
    onDelete: (eventId: string) => void;
    onView: (eventId: string) => void;
    formatDate: (date: string) => string;
    getStatusBadge: (status: string, isLive?: boolean) => React.ReactNode;
}

export const EventsTable: React.FC<EventsTableProps> = ({
    events,
    onDelete,
    onView,
    formatDate,
    getStatusBadge,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [organizerFilter, setOrganizerFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Extract unique values for filters
    const locations = useMemo(() => {
        const unique = [...new Set(events.map(e => e.location.name))];
        return unique.map(name => ({ label: name, value: name }));
    }, [events]);

    const organizers = useMemo(() => {
        const unique = [...new Set(events.map(e => e.organizer.username))];
        return unique.map(username => ({ label: username, value: username }));
    }, [events]);

    const dateOptions = [
        { label: 'All Time', value: '' },
        { label: 'Today', value: 'today' },
        { label: 'This Week', value: 'week' },
        { label: 'This Month', value: 'month' },
    ];

    // Filter logic
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                event.location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                event.organizer.username.toLowerCase().includes(searchQuery.toLowerCase());

            // Location filter
            const matchesLocation = locationFilter === '' || event.location.name === locationFilter;

            // Organizer filter
            const matchesOrganizer = organizerFilter === '' || event.organizer.username === organizerFilter;

            // Date filter
            let matchesDate = true;
            if (dateFilter && dateFilter !== '') {
                const eventDate = new Date(event.startTime);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                switch (dateFilter) {
                    case 'today': {
                        matchesDate = eventDate >= today;
                        break;
                    }
                    case 'week': {
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        matchesDate = eventDate >= weekAgo;
                        break;
                    }
                    case 'month': {
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        matchesDate = eventDate >= monthAgo;
                        break;
                    }
                    default:
                        break;
                }
            }

            return matchesSearch && matchesLocation && matchesOrganizer && matchesDate;
        });
    }, [events, searchQuery, locationFilter, organizerFilter, dateFilter]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    All Events ({filteredEvents.length} of {events.length})
                </h3>

                <AdminFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    showFilter={false}
                />

                {/* Additional filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">All Locations</option>
                        {locations.map((loc) => (
                            <option key={loc.value} value={loc.value}>
                                {loc.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={organizerFilter}
                        onChange={(e) => setOrganizerFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">All Organizers</option>
                        {organizers.map((org) => (
                            <option key={org.value} value={org.value}>
                                {org.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {dateOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organizer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    No events found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            filteredEvents.map(event => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{event.title}</div>
                                            {event.description && (
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{event.description}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.location.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.organizer.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(event.status, event.isLive)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(event.startTime)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.totalAttendees || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => onView(event.id)}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(event.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};