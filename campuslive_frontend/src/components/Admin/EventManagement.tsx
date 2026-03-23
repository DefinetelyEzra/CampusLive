import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../toastContext';
import {
    Calendar,
    Plus,
    Trash2,
    MapPin,
    Users,
    Clock,
    RefreshCw,
    Save,
    X,
    Eye,
    Play,
    Square,
    ChevronRight,
    ChevronDown,
    Edit
} from 'lucide-react';
import type { Event, Location, CreateEventRequest } from '../../types';
import AccessKeyModal from '../Events/AccessKeyModal';
import RecurringConflictModal from '../Events/RecurringConflictModal';

interface EventManagementProps {
    onEventCreated?: (event: Event) => void;
    isModerator?: boolean;
}

const EventManagement: React.FC<EventManagementProps> = ({ onEventCreated, isModerator = false }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [showAccessKeyModal, setShowAccessKeyModal] = useState(false);
    const [generatedAccessKey, setGeneratedAccessKey] = useState<string | null>(null);
    const [createdEventTitle, setCreatedEventTitle] = useState<string>('');
    const { showToast } = useToast();
    const [showConflictModal, setShowConflictModal] = useState(false);
    const { user } = useAuthStore();

    const [conflictData, setConflictData] = useState<{
        totalInstances: number;
        conflictingInstances: Array<{
            startTime: string;
            endTime: string;
            conflictsWith: string[];
        }>;
        locationName: string;
        originalFormData: {
            title: string;
            description?: string;
            locationId: string;
            maxAttendees?: number;
            isPrivate?: boolean;
            isRecurring?: boolean;
            recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
            recurrenceEndDate?: string;
            startTime: string;
            endTime: string;
        };
    } | null>(null);

    const [formData, setFormData] = useState<CreateEventRequest>({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        locationId: '',
        maxAttendees: undefined,
        // Advanced options
        isPrivate: false,
        isRecurring: false,
        recurrenceType: undefined,
        recurrenceEndDate: '',
    });

    const loadEvents = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await apiService.getAllEvents();
            const eventsArray = Array.isArray(data) ? data : [];

            // Filter events for moderators (only show their own events)
            const filteredEvents = isModerator
                ? eventsArray.filter(event => event.organizer.id === user?.id)
                : eventsArray;

            const sortedEvents = [...filteredEvents].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setEvents(sortedEvents);
        } catch (error) {
            console.error('Failed to load events:', error);
            showToast('Failed to load events', 'error');
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [showToast, isModerator, user?.id]);

    const loadLocations = useCallback(async () => {
        try {
            const data = await apiService.getAllLocations();
            // Ensure data is always an array
            setLocations(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load locations:', error);
            showToast('Failed to load locations', 'error');
            setLocations([]); // Set empty array on error
        }
    }, [showToast]);

    useEffect(() => {
        loadEvents();
        loadLocations();
    }, [loadEvents, loadLocations]);

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            startTime: '',
            endTime: '',
            locationId: '',
            maxAttendees: undefined,
            isPrivate: false,
            isRecurring: false,
            recurrenceType: undefined,
            recurrenceEndDate: '',
        });
        setShowAdvancedOptions(false);
        setEditingEvent(null);
    };

    const convertToISOString = (datetimeLocal: string): string => {
        if (!datetimeLocal) return '';
        try {
            // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string
            const date = new Date(datetimeLocal);
            if (Number.isNaN(date.getTime())) {
                throw new TypeError('Invalid date');
            }
            return date.toISOString();
        } catch (error) {
            console.error('Date conversion error:', error);
            return '';
        }
    };

    const handleEdit = (event: Event) => {
        // Only allow editing of UPCOMING events
        if (event.status !== 'UPCOMING') {
            showToast('Can only edit upcoming events', 'error');
            return;
        }

        setEditingEvent(event);

        // Convert ISO strings back to datetime-local format
        const startTimeLocal = new Date(event.startTime).toISOString().slice(0, 16);
        const endTimeLocal = new Date(event.endTime).toISOString().slice(0, 16);

        setFormData({
            title: event.title,
            description: event.description || '',
            startTime: startTimeLocal,
            endTime: endTimeLocal,
            locationId: event.locationId,
            maxAttendees: event.maxAttendees,
            // Advanced options are NOT editable, so we don't populate them
            isPrivate: false,
            isRecurring: false,
            recurrenceType: undefined,
            recurrenceEndDate: '',
        });

        setShowCreateForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            setIsLoading(true);

            if (editingEvent) {
                // Update existing event
                const updateData = {
                    title: formData.title,
                    description: formData.description,
                    startTime: convertToISOString(formData.startTime),
                    endTime: convertToISOString(formData.endTime),
                };

                await apiService.updateEvent(editingEvent.id, updateData);
                showToast('Event updated successfully', 'success');
            } else {
                // Create new event
                await saveEvent();
            }

            await loadEvents();
            setShowCreateForm(false);
            resetForm();
        } catch (error) {
            console.error('Failed to save event:', error);
            showToast(
                `Failed to ${editingEvent ? 'update' : 'create'} event: ${error instanceof Error ? error.message : 'Unknown error'
                }`,
                'error'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Helper functions for handleSubmit
    const validateForm = (): boolean => {
        const startDate = new Date(formData.startTime);
        const now = new Date();

        if (!formData.endTime) {
            showToast('End time is required for all events', 'error');
            return false;
        }

        const endDate = new Date(formData.endTime);

        if (startDate <= now) {
            showToast('Start time must be in the future', 'error');
            return false;
        }

        if (endDate <= startDate) {
            showToast('End time must be after start time', 'error');
            return false;
        }

        if ((endDate.getTime() - startDate.getTime()) > 24 * 60 * 60 * 1000) {
            showToast('Event duration cannot exceed 24 hours', 'error');
            return false;
        }

        return validateRecurringEvent();
    };

    const validateRecurringEvent = (): boolean => {
        if (!formData.isRecurring) return true;

        if (!formData.recurrenceType) {
            showToast('Please select a recurrence type', 'error');
            return false;
        }

        if (!formData.recurrenceEndDate) {
            showToast('Please specify when recurring events should end', 'error');
            return false;
        }

        const recurrenceEnd = new Date(formData.recurrenceEndDate);
        const startDate = new Date(formData.startTime);

        if (recurrenceEnd <= startDate) {
            showToast('Recurrence end date must be after start time', 'error');
            return false;
        }

        return true;
    };

    const saveEvent = async () => {
        const eventData: CreateEventRequest = {
            ...formData,
            startTime: convertToISOString(formData.startTime),
            endTime: convertToISOString(formData.endTime),
            recurrenceEndDate: formData.recurrenceEndDate ? convertToISOString(formData.recurrenceEndDate) : undefined
        };

        if (editingEvent) {
            showToast('Event editing not yet implemented', 'error');
            return;
        }

        const response = await apiService.createEvent(eventData);

        // Check if response indicates conflicts
        const hasConflicts = (resp: typeof response): resp is {
            hasConflicts: true;
            totalInstances: number;
            conflictingInstances: Array<{
                startTime: string;
                endTime: string;
                conflictsWith: string[];
            }>;
            eventData: CreateEventRequest;
            locationName: string;
        } => {
            return 'hasConflicts' in resp && resp.hasConflicts === true;
        };

        if (hasConflicts(response)) {
            setConflictData({
                totalInstances: response.totalInstances,
                conflictingInstances: response.conflictingInstances,
                locationName: response.locationName,
                originalFormData: {
                    title: formData.title,
                    description: formData.description,
                    locationId: formData.locationId,
                    maxAttendees: formData.maxAttendees,
                    isPrivate: formData.isPrivate ?? false,
                    isRecurring: formData.isRecurring ?? false,
                    recurrenceType: formData.recurrenceType,
                    recurrenceEndDate: formData.recurrenceEndDate ?? '',
                    startTime: formData.startTime,
                    endTime: formData.endTime
                }
            });
            setShowConflictModal(true);
            return;
        }

        const isPrivateEventResponse = (resp: typeof response): resp is {
            event: Event;
            accessKey: string;
            message: string
        } => {
            return 'accessKey' in resp && typeof resp.accessKey === 'string';
        };

        if (isPrivateEventResponse(response)) {
            setShowCreateForm(false);
            setGeneratedAccessKey(response.accessKey);
            setCreatedEventTitle(response.event.title);
            setShowAccessKeyModal(true);
            onEventCreated?.(response.event);
        } else {
            showToast(
                formData.isRecurring
                    ? 'Recurring event series created successfully'
                    : 'Event created successfully',
                'success'
            );
            onEventCreated?.(response);
        }
    };

    const handleDelete = async (eventId: string, eventTitle: string) => {
        if (!confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) return;

        try {
            await apiService.deleteEvent(eventId);
            showToast('Event deleted successfully', 'success');
            await loadEvents();
        } catch (error) {
            console.error('Failed to delete event:', error);
            showToast(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const handleToggleLive = async (eventId: string, isLive: boolean) => {
        try {
            await apiService.toggleEventLive(eventId, !isLive);
            showToast(`Event ${isLive ? 'stopped' : 'started'} successfully`, 'success');
            await loadEvents();
        } catch (error) {
            console.error('Failed to toggle event live status:', error);
            showToast(`Failed to ${isLive ? 'stop' : 'start'} event: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const handleEndEvent = async (eventId: string, eventTitle: string) => {
        if (!confirm(`Are you sure you want to end "${eventTitle}"? This will remove all attendees.`)) return;

        try {
            await apiService.endEvent(eventId);
            showToast('Event ended successfully', 'success');
            await loadEvents();
        } catch (error) {
            console.error('Failed to end event:', error);
            showToast(`Failed to end event: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const getStatusBadge = (status: string, isLive?: boolean) => {
        const colors = {
            LIVE: 'bg-green-100 text-green-800',
            UPCOMING: 'bg-blue-100 text-blue-800',
            ENDED: 'bg-gray-100 text-gray-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        const displayStatus = isLive ? 'LIVE' : status;
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[displayStatus as keyof typeof colors]}`}>
                {displayStatus}
            </span>
        );
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Calendar className="h-6 w-6 text-purple-500 mr-2" />
                    Event Management ({events.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { resetForm(); setShowCreateForm(true); }}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Create Event</span>
                    </button>
                    <button
                        onClick={loadEvents}
                        disabled={isLoading}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Create/Edit Form Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingEvent ? 'Edit Event' : 'Create New Event'}
                                </h3>
                                <button
                                    onClick={() => { setShowCreateForm(false); resetForm(); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        id="event-title"
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        id="event-description"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <select
                                        id="event-location"
                                        value={formData.locationId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, locationId: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    >
                                        <option value="">Select a location</option>
                                        {Array.isArray(locations) && locations.map(location => (
                                            <option key={location.id} value={location.id}>
                                                {location.name}
                                            </option>
                                        ))}
                                    </select>
                                    {(!Array.isArray(locations) || locations.length === 0) && (
                                        <p className="text-sm text-red-600 mt-1">
                                            No locations available. Please create locations first.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="event-start-time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input
                                        id="event-start-time"
                                        type="datetime-local"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                        min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)} // 10 minutes from now
                                    />
                                </div>

                                <div>
                                    <label htmlFor="event-end-time" className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="event-end-time"
                                        type="datetime-local"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                        min={formData.startTime || new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        End time is required for all events
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="event-max-attendees" className="block text-sm font-medium text-gray-700 mb-1">Max Attendees (Optional)</label>
                                    <input
                                        id="event-max-attendees"
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={formData.maxAttendees || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value ? Number.parseInt(e.target.value) : undefined }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="Leave empty for unlimited"
                                    />
                                </div>

                                {/* Advanced Options Toggle */}
                                {!editingEvent && (
                                    <div className="border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                                            className="flex items-center space-x-2 text-sm text-purple-600 hover:text-purple-700"
                                        >
                                            {showAdvancedOptions ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            <span>Advanced Options</span>
                                        </button>
                                    </div>
                                )}

                                {/* Advanced Options Section */}
                                {!editingEvent && showAdvancedOptions && (
                                    <div className="space-y-4 border-t pt-4">
                                        {/* Private Event */}
                                        <div className="flex items-center space-x-2">
                                            <input
                                                id="event-private"
                                                type="checkbox"
                                                checked={formData.isPrivate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <label htmlFor="event-private" className="text-sm font-medium text-gray-700">
                                                Private Event (requires access key to join)
                                            </label>
                                        </div>

                                        {/* Recurring Event */}
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    id="event-recurring"
                                                    type="checkbox"
                                                    checked={formData.isRecurring}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        isRecurring: e.target.checked,
                                                        recurrenceType: e.target.checked ? 'WEEKLY' : undefined
                                                    }))}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                <label htmlFor="event-recurring" className="text-sm font-medium text-gray-700">
                                                    Recurring Event
                                                </label>
                                            </div>

                                            {formData.isRecurring && (
                                                <div className="ml-6 space-y-3">
                                                    <div>
                                                        <label htmlFor="recurrence-type" className="block text-sm font-medium text-gray-700 mb-1">
                                                            Repeat Every
                                                        </label>
                                                        <select
                                                            id="recurrence-type"
                                                            value={formData.recurrenceType || ''}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev,
                                                                recurrenceType: e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY'
                                                            }))}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            required={formData.isRecurring}
                                                        >
                                                            <option value="DAILY">Day</option>
                                                            <option value="WEEKLY">Week</option>
                                                            <option value="MONTHLY">Month</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="recurrence-end" className="block text-sm font-medium text-gray-700 mb-1">
                                                            End Recurrence On
                                                        </label>
                                                        <input
                                                            id="recurrence-end"
                                                            type="date"
                                                            value={formData.recurrenceEndDate}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            required={formData.isRecurring}
                                                            min={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : undefined}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Recurring events will be created until this date
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowCreateForm(false); resetForm(); }}
                                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !Array.isArray(locations) || locations.length === 0}
                                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span>{editingEvent ? 'Update' : 'Create'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Access Key Modal */}
            {showAccessKeyModal && generatedAccessKey && (
                <AccessKeyModal
                    accessKeyValue={generatedAccessKey}
                    eventTitle={createdEventTitle}
                    onClose={() => {
                        setShowAccessKeyModal(false);
                        setGeneratedAccessKey(null);
                        setCreatedEventTitle('');
                        showToast('Private event created successfully', 'success');
                    }}
                />
            )}

            {/* Recurring Conflict Modal */}
            {showConflictModal && conflictData && (
                <RecurringConflictModal
                    eventTitle={conflictData.originalFormData.title}
                    locationName={conflictData.locationName}
                    totalInstances={conflictData.totalInstances}
                    conflictingInstances={conflictData.conflictingInstances.map(c => ({
                        startTime: new Date(c.startTime),
                        endTime: new Date(c.endTime),
                        conflictsWith: c.conflictsWith
                    }))}
                    originalStartTime={conflictData.originalFormData.startTime}
                    originalEndTime={conflictData.originalFormData.endTime}
                    onCancel={() => {
                        setShowConflictModal(false);
                        setShowCreateForm(false);
                        setConflictData(null);
                        resetForm();
                        showToast('Event creation cancelled', 'info');
                    }}
                    onResolve={async (newStartTime: string, newEndTime: string) => {
                        if (!conflictData) return;

                        setShowConflictModal(false);
                        setIsLoading(true);

                        try {
                            const updatedEventData: CreateEventRequest = {
                                title: conflictData.originalFormData.title,
                                description: conflictData.originalFormData.description || '',
                                locationId: conflictData.originalFormData.locationId,
                                maxAttendees: conflictData.originalFormData.maxAttendees,
                                isPrivate: conflictData.originalFormData.isPrivate || false,
                                isRecurring: conflictData.originalFormData.isRecurring || false,
                                recurrenceType: conflictData.originalFormData.recurrenceType,
                                recurrenceEndDate: conflictData.originalFormData.recurrenceEndDate ?
                                    convertToISOString(conflictData.originalFormData.recurrenceEndDate) : undefined,
                                startTime: convertToISOString(newStartTime),
                                endTime: convertToISOString(newEndTime),
                            };

                            const response = await apiService.createEvent(updatedEventData);

                            const hasConflicts = (resp: typeof response): resp is {
                                hasConflicts: true;
                                totalInstances: number;
                                conflictingInstances: Array<{
                                    startTime: string;
                                    endTime: string;
                                    conflictsWith: string[];
                                }>;
                                eventData: CreateEventRequest;
                                locationName: string;
                            } => {
                                return 'hasConflicts' in resp && resp.hasConflicts === true;
                            };

                            if (hasConflicts(response)) {
                                setConflictData({
                                    totalInstances: response.totalInstances,
                                    conflictingInstances: response.conflictingInstances,
                                    locationName: response.locationName,
                                    originalFormData: {
                                        ...conflictData.originalFormData,
                                        startTime: newStartTime,
                                        endTime: newEndTime
                                    }
                                });

                                setShowConflictModal(true);
                                showToast('Conflicts still exist. Please try a different time.');
                            } else {
                                const isPrivateEventResponse = (resp: typeof response): resp is {
                                    event: Event;
                                    accessKey: string;
                                    message: string
                                } => {
                                    return 'accessKey' in resp && typeof resp.accessKey === 'string';
                                };

                                setShowCreateForm(false);
                                setConflictData(null);

                                if (isPrivateEventResponse(response)) {
                                    setGeneratedAccessKey(response.accessKey);
                                    setCreatedEventTitle(response.event.title);
                                    setShowAccessKeyModal(true);
                                    onEventCreated?.(response.event);
                                } else {
                                    showToast('Recurring event created successfully!', 'success');
                                    onEventCreated?.(response);
                                }

                                await loadEvents();
                                resetForm();
                            }
                        } catch (error) {
                            showToast(
                                `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                'error'
                            );
                            setShowConflictModal(true);
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                />
            )}

            {/* Events Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendees</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {Array.isArray(events) && events.map(event => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{event.title}</div>
                                            {event.description && (
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{event.description}</div>
                                            )}
                                            <div className="text-xs text-gray-400">by {event.organizer.username}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-sm text-gray-900">
                                            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                                            {event.location.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div className="flex items-center">
                                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                                            <div>
                                                <div>Start: {formatDateTime(event.startTime)}</div>
                                                {event.endTime && <div>End: {formatDateTime(event.endTime)}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(event.status, event.isLive)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Users className="h-4 w-4 mr-1 text-gray-400" />
                                            <span>{event.attendeeCount || 0}</span>
                                            {event.maxAttendees && <span className="text-gray-500">/{event.maxAttendees}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => window.open(`/event/${event.id}`, '_blank')}
                                                className="text-blue-600 hover:text-blue-900"
                                                title="View event"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>

                                            {/* Add Edit button. Only for UPCOMING events */}
                                            {event.status === 'UPCOMING' && (
                                                <button
                                                    onClick={() => handleEdit(event)}
                                                    className="text-purple-600 hover:text-purple-900"
                                                    title="Edit event"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                            )}

                                            {event.status === 'UPCOMING' && (
                                                <button
                                                    onClick={() => handleToggleLive(event.id, event.isLive)}
                                                    className="text-green-600 hover:text-green-900"
                                                    title="Start event"
                                                >
                                                    <Play className="h-4 w-4" />
                                                </button>
                                            )}

                                            {event.status === 'LIVE' && event.isLive && (
                                                <>
                                                    <button
                                                        onClick={() => handleToggleLive(event.id, event.isLive)}
                                                        className="text-yellow-600 hover:text-yellow-900"
                                                        title="Stop event"
                                                    >
                                                        <Square className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEndEvent(event.id, event.title)}
                                                        className="text-orange-600 hover:text-orange-900"
                                                        title="End event"
                                                    >
                                                        <Square className="h-4 w-4 fill-current" />
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                onClick={() => handleDelete(event.id, event.title)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete event"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {events.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-gray-500">
                            No events found. Create your first event to get started.
                        </div>
                    )}

                    {isLoading && (
                        <div className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-purple-500" />
                            <p className="text-gray-500 mt-2">Loading events...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventManagement;