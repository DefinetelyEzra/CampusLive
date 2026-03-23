import React, { useState } from 'react';
import { X, AlertTriangle, Calendar, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface ConflictingInstance {
    startTime: Date;
    endTime: Date;
    conflictsWith: string[];
}

interface RecurringConflictModalProps {
    eventTitle: string;
    locationName: string;
    totalInstances: number;
    conflictingInstances: ConflictingInstance[];
    originalStartTime: string;
    originalEndTime: string;
    onCancel: () => void;
    onResolve: (newStartTime: string, newEndTime: string) => void;
}

const RecurringConflictModal: React.FC<RecurringConflictModalProps> = ({
    eventTitle,
    locationName,
    totalInstances,
    conflictingInstances,
    originalStartTime,
    originalEndTime,
    onCancel,
    onResolve
}) => {
    const [showAllConflicts, setShowAllConflicts] = useState(false);
    const [showAdjustForm, setShowAdjustForm] = useState(false);
    const [newStartTime, setNewStartTime] = useState(originalStartTime);
    const [newEndTime, setNewEndTime] = useState(originalEndTime);

    const validInstances = totalInstances - conflictingInstances.length;
    const conflictsToShow = showAllConflicts ? conflictingInstances : conflictingInstances.slice(0, 5);

    const formatDateTime = (date: Date) => {
        return new Date(date).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTimeRange = (start: Date, end: Date) => {
        const startStr = formatDateTime(start);
        const endTime = new Date(end).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        return `${startStr} - ${endTime}`;
    };

    const handleAdjustSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const startDate = new Date(newStartTime);
        const endDate = new Date(newEndTime);

        if (endDate <= startDate) {
            alert('End time must be after start time');
            return;
        }

        if ((endDate.getTime() - startDate.getTime()) > 24 * 60 * 60 * 1000) {
            alert('Event duration cannot exceed 24 hours');
            return;
        }

        onResolve(newStartTime, newEndTime);
    };

    if (showAdjustForm) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                                <button
                                    onClick={() => setShowAdjustForm(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                                </button>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Adjust Event Time</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Change the time to avoid conflicts
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Adjusting the time will recalculate all recurring instances with the new schedule.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="adjust-start-time" className="block text-sm font-medium text-gray-700 mb-1">
                                New Start Time
                            </label>
                            <input
                                id="adjust-start-time"
                                type="datetime-local"
                                value={newStartTime}
                                onChange={(e) => setNewStartTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                                min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                            />
                        </div>

                        <div>
                            <label htmlFor="adjust-end-time" className="block text-sm font-medium text-gray-700 mb-1">
                                New End Time
                            </label>
                            <input
                                id="adjust-end-time"
                                type="datetime-local"
                                value={newEndTime}
                                onChange={(e) => setNewEndTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                                min={newStartTime}
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setShowAdjustForm(false)}
                                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                                Check Availability
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Scheduling Conflicts Detected</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Some recurring instances conflict with existing events
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="p-6 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <span className="text-sm font-medium text-gray-600">Total Instances</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{totalInstances}</p>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-medium text-gray-600">Available</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{validInstances}</p>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-red-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <XCircle className="h-5 w-5 text-red-600" />
                                <span className="text-sm font-medium text-gray-600">Conflicts</span>
                            </div>
                            <p className="text-2xl font-bold text-red-600">{conflictingInstances.length}</p>
                        </div>
                    </div>
                </div>

                {/* Event Info */}
                <div className="p-6 bg-blue-50 border-b border-blue-100">
                    <h4 className="font-semibold text-blue-900 mb-2">Your Event Details</h4>
                    <div className="text-sm text-blue-800">
                        <p className="font-medium">{eventTitle}</p>
                        <p className="text-blue-600">Location: {locationName}</p>
                    </div>
                </div>

                {/* Conflicts List */}
                <div className="p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">
                        Conflicting Time Slots ({conflictingInstances.length})
                    </h4>

                    <div className="space-y-3">
                        {conflictsToShow.map((conflict, index) => (
                            <div
                                key={`${formatDateTime(conflict.startTime)}-${index}`}
                                className="bg-red-50 border border-red-200 rounded-lg p-4"
                            >
                                <div className="flex items-start space-x-3">
                                    <Clock className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 mb-1">
                                            {formatTimeRange(conflict.startTime, conflict.endTime)}
                                        </p>
                                        <div className="text-sm text-red-800">
                                            <p className="font-medium mb-1">Conflicts with:</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                {conflict.conflictsWith.map((eventTitle, idx) => (
                                                    <li key={`${eventTitle}-${idx}`} className="truncate">{eventTitle}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {conflictingInstances.length > 5 && !showAllConflicts && (
                        <button
                            onClick={() => setShowAllConflicts(true)}
                            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Show all {conflictingInstances.length} conflicts
                        </button>
                    )}

                    {showAllConflicts && conflictingInstances.length > 5 && (
                        <button
                            onClick={() => setShowAllConflicts(false)}
                            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Show less
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-3">
                        {/* Option 1: Adjust Time */}
                        <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h5 className="font-semibold text-gray-900 mb-1">
                                        Adjust Event Time (Recommended)
                                    </h5>
                                    <p className="text-sm text-gray-600">
                                        Change your event's start or end time to avoid all conflicts. This ensures all {totalInstances} instances are created.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowAdjustForm(true)}
                                    className="ml-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium whitespace-nowrap"
                                >
                                    Adjust Time
                                </button>
                            </div>
                        </div>

                        {/* Option 2: Cancel */}
                        <div className="flex justify-center">
                            <button
                                onClick={onCancel}
                                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                            >
                                Cancel Event Creation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecurringConflictModal;