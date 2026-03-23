import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { useToast } from '../toastContext';
import { Shield, Calendar, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import EventManagement from '../Admin/EventManagement';
import LoadingScreen from '../LoadingScreen';

const ModeratorPanel: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { currentRole, fetchCurrentRole } = useRoleStore();
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkModeratorAccess = async () => {
            try {
                // Fetch current role to ensure we have the latest data
                await fetchCurrentRole();
                setIsChecking(false);
            } catch (error) {
                console.error('Failed to fetch current role:', error);
                setIsChecking(false);
            }
        };

        checkModeratorAccess();
    }, [fetchCurrentRole]);

    useEffect(() => {
        // Only check after we've finished loading
        if (!isChecking) {
            if (!currentRole || currentRole.roleType !== 'MODERATOR') {
                showToast('You must have an active moderator role to access this panel', 'error');
                navigate('/roles');
            }
        }
    }, [currentRole, isChecking, navigate, showToast]);

    // Show loading while checking access
    if (isChecking) {
        return <LoadingScreen />;
    }

    // Don't render if not a moderator
    if (!currentRole || currentRole.roleType !== 'MODERATOR') {
        return null;
    }

    const getRemainingTime = () => {
        if (!currentRole.expiresAt) return 'No expiry';

        const now = new Date();
        const expiry = new Date(currentRole.expiresAt);
        const diffMs = expiry.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ${hours}h`;
        }
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    const isExpiringSoon = () => {
        if (!currentRole.expiresAt) return false;

        const now = new Date();
        const expiry = new Date(currentRole.expiresAt);
        const diffMs = expiry.getTime() - now.getTime();
        const hoursRemaining = diffMs / (1000 * 60 * 60);

        return hoursRemaining <= 24 && hoursRemaining > 0;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
                    {/* Mobile Layout */}
                    <div className="md:hidden">
                        {/* Top row with back button and title */}
                        <div className="flex items-center justify-between mb-3">
                            <button
                                onClick={() => navigate('/map')}
                                className="p-2 hover:bg-purple-500 rounded-lg transition flex-shrink-0"
                                aria-label="Back to map"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>

                            <div className="flex items-center space-x-2 flex-1 justify-center">
                                <div className="p-1.5 bg-purple-500 rounded-lg">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold">Moderator Panel</h1>
                                </div>
                            </div>

                            {/* Spacer for centering */}
                            <div className="w-9"></div>
                        </div>

                        {/* Mobile status indicator */}
                        <div className="bg-purple-500 bg-opacity-50 backdrop-blur rounded-lg px-3 py-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-purple-100 flex-shrink-0" />
                                    <span className="text-xs text-purple-200">Token expires:</span>
                                </div>
                                <span className={`text-xs font-semibold ${isExpiringSoon() ? 'text-yellow-300' : 'text-white'}`}>
                                    {getRemainingTime()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:flex items-center justify-between">
                        {/* Back button */}
                        <button
                            onClick={() => navigate('/map')}
                            className="p-2 hover:bg-purple-500 rounded-lg transition"
                            aria-label="Back to map"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>

                        {/* Centered Title Section */}
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-purple-500 rounded-lg">
                                <Shield className="h-8 w-8" />
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl font-bold">Moderator Panel</h1>
                                <p className="text-purple-200 text-sm">{user?.username}</p>
                            </div>
                        </div>

                        {/* Moderator Status Card */}
                        <div className="flex items-center space-x-4">
                            <div className="bg-purple-500 bg-opacity-50 backdrop-blur rounded-lg px-4 py-3">
                                <div className="flex items-center space-x-3">
                                    <Clock className="h-5 w-5 text-purple-100" />
                                    <div>
                                        <p className="text-xs text-purple-200">Token Expires In</p>
                                        <p className={`text-sm font-semibold ${isExpiringSoon() ? 'text-yellow-300' : 'text-white'}`}>
                                            {getRemainingTime()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                {/* Warning banner if expiring soon */}
                {isExpiringSoon() && (
                    <div className="mb-4 sm:mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded-r-lg">
                        <div className="flex items-start">
                            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-yellow-800">Token Expiring Soon</h3>
                                <p className="text-xs sm:text-sm text-yellow-700 mt-1">
                                    Your moderator token will expire in {getRemainingTime()}. You'll need a new token to continue as a moderator.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex items-start space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Event Management</h2>
                            <p className="text-xs sm:text-sm text-gray-600">
                                As a moderator, you can create and manage events. You have the ability to:
                            </p>
                            <ul className="mt-2 space-y-1.5 text-xs sm:text-sm text-gray-600">
                                <li className="flex items-start space-x-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                    <span>Create new events (public, private, and recurring)</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                    <span>Start and stop live events</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                    <span>Edit upcoming events (title, description, time)</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                    <span>End events and manage attendees</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Event Management Component */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 overflow-hidden">
                    <EventManagement isModerator={true} />
                </div>
            </main>
        </div>
    );
};

export default ModeratorPanel;