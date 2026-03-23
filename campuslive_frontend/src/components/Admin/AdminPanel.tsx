import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '../../services/api';
import { useToast } from '../toastContext';
import {
  ArrowLeft,
  Shield,
  Users,
  Calendar,
  Settings,
  Key,
  Activity,
  RefreshCw,
  MapPin,
  Plus
} from 'lucide-react';
import type { Event, UserWithStats, ModeratorToken, UserAppRole } from '../../types';
import LocationManagement from './LocationManagement';
import EventManagement from './EventManagement';
import { EventsTable } from './adminTables/EventsTable';
import { UsersTable } from './adminTables/UsersTable';
import { ModeratorsTable } from './adminTables/ModeratorsTable';
import { TokensTable } from './adminTables/TokensTable';

interface UserWithTimestamps extends UserWithStats {
  createdAt?: string;
}

interface ModeratorTokenWithUser extends ModeratorToken {
  usedByUser?: {
    id: string;
    username: string;
    email: string;
  };
}

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'users' | 'moderators' | 'tokens' | 'locations' | 'create-events'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithTimestamps[]>([]);
  const [moderatorTokens, setModeratorTokens] = useState<ModeratorTokenWithUser[]>([]);
  const [activeModerators, setActiveModerators] = useState<UserAppRole[]>([]);
  const [newTokenCount, setNewTokenCount] = useState(1);
  const [copiedToken, setCopiedToken] = useState<string>('');
  const { showToast } = useToast();

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/map');
    }
  }, [user, navigate]);

  const handleApiError = useCallback((action: string, error: unknown) => {
    console.error(`Failed to ${action}:`, error);
  }, []);

  const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      if (a.isLive && b.isLive) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (a.status === 'UPCOMING' && b.status !== 'UPCOMING') return -1;
      if (a.status !== 'UPCOMING' && b.status === 'UPCOMING') return 1;
      if (a.status === 'UPCOMING' && b.status === 'UPCOMING') {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const loadLiveEvents = useCallback(async () => {
    try {
      const data = await apiService.getAllEvents();
      const liveEventsData = data.filter(event => event.isLive && event.status === 'LIVE');
      setLiveEvents(sortEvents(liveEventsData));
    } catch (error) {
      handleApiError('load live events', error);
    }
  }, [handleApiError]);

  const loadAllEvents = useCallback(async () => {
    try {
      const data = await apiService.getAllEvents();
      setAllEvents(sortEvents(data));
    } catch (error) {
      handleApiError('load events', error);
    }
  }, [handleApiError]);

  const loadAllUsers = useCallback(async () => {
    try {
      const data = await apiService.getAllUsers();
      setAllUsers(data);
    } catch (error) {
      handleApiError('load users', error);
    }
  }, [handleApiError]);

  const loadModeratorTokens = useCallback(async () => {
    try {
      const data = await apiService.getAllModeratorTokens();
      setModeratorTokens(data);
    } catch (error) {
      handleApiError('load moderator tokens', error);
    }
  }, [handleApiError]);

  const loadActiveModerators = useCallback(async () => {
    try {
      const data = await apiService.getActiveModerators();
      setActiveModerators(data);
    } catch (error) {
      handleApiError('load active moderators', error);
    }
  }, [handleApiError]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadLiveEvents(),
        loadAllEvents(),
        loadAllUsers(),
        loadModeratorTokens(),
        loadActiveModerators()
      ]);
    } catch (error) {
      handleApiError('load admin data', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadLiveEvents, loadAllEvents, loadAllUsers, loadModeratorTokens, loadActiveModerators, handleApiError]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const generateModeratorTokens = async () => {
    try {
      setIsLoading(true);
      await apiService.generateModeratorTokens(newTokenCount);
      showToast(`Successfully generated ${newTokenCount} moderator tokens`, 'success');
      await loadModeratorTokens();
      setNewTokenCount(1);
    } catch (error) {
      handleApiError('generate tokens', error);
      showToast(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await apiService.deleteEvent(eventId);
      showToast('Event deleted successfully', 'success');
      await Promise.all([loadAllEvents(), loadLiveEvents()]);
    } catch (error) {
      handleApiError('delete event', error);
      showToast(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await apiService.deleteUser(userId);
      showToast('User deleted successfully', 'success');
      await Promise.all([loadAllUsers(), loadActiveModerators()]);
    } catch (error) {
      handleApiError('delete user', error);
      showToast(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const copyTokenToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
    showToast('Token copied to clipboard', 'success');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  const getUserRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'FACULTY':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Live Events</p>
              <p className="text-2xl font-bold text-green-600">{liveEvents.length}</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-blue-600">{allEvents.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-purple-600">{allUsers.length}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Moderators</p>
              <p className="text-2xl font-bold text-orange-600">{activeModerators.length}</p>
            </div>
            <Shield className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="h-5 w-5 text-green-500 mr-2" />
            Live Events ({liveEvents.length})
          </h3>
        </div>
        <div className="p-6">
          {liveEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No live events at the moment</p>
          ) : (
            <div className="grid gap-4">
              {liveEvents.map(event => (
                <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{event.title}</h4>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {event.location.name}
                      </span>
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {event.totalAttendees || 0} participants
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(event.status, event.isLive)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderEvents = () => (
    <EventsTable
      events={allEvents}
      onDelete={deleteEvent}
      onView={(eventId) => window.open(`/event/${eventId}`, '_blank')}
      formatDate={formatDate}
      getStatusBadge={getStatusBadge}
    />
  );

  const renderUsers = () => (
    <UsersTable
      users={allUsers}
      onDelete={deleteUser}
      formatDate={formatDate}
      getUserRoleBadgeClass={getUserRoleBadgeClass}
    />
  );

  const renderModerators = () => (
    <ModeratorsTable
      moderators={activeModerators}
      formatDate={formatDate}
    />
  );

  const renderTokens = () => (
    <TokensTable
      tokens={moderatorTokens}
      formatDate={formatDate}
      onCopyToken={copyTokenToClipboard}
      copiedToken={copiedToken}
      onGenerate={generateModeratorTokens}
      isGenerating={isLoading}
      newTokenCount={newTokenCount}
      onTokenCountChange={setNewTokenCount}
    />
  );

  const tabs: {
    id: 'dashboard' | 'events' | 'users' | 'moderators' | 'tokens' | 'locations' | 'create-events';
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: Activity },
      { id: 'events', label: 'Events', icon: Calendar },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'moderators', label: 'Moderators', icon: Shield },
      { id: 'tokens', label: 'Tokens', icon: Key },
      { id: 'locations', label: 'Locations', icon: MapPin },
      { id: 'create-events', label: 'Create Events', icon: Plus }
    ];

  if (user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 py-4 sm:py-0 space-y-4 sm:space-y-0">
            <div className="hidden sm:flex items-center space-x-4">
              <button
                onClick={() => navigate('/map')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                <span className="font-medium">Back to Map</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
            </div>

            <div className="flex items-center justify-center space-x-2 flex-1 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2">
              <Settings className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Panel</h1>
            </div>

            <div className="flex items-center space-x-2 sm:static">
              <Shield className="h-5 w-5 text-purple-500" />
              <div className="text-sm text-center sm:text-left">
                <p className="font-medium text-gray-900">{user?.username}</p>
                <p className="text-purple-600 font-semibold">{user?.role}</p>
              </div>
            </div>

            <div className="sm:hidden w-full">
              <button
                onClick={() => navigate('/map')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group w-full justify-center"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                <span className="font-medium">Back to Map</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors duration-200 ${activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 bg-purple-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'events' && renderEvents()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'moderators' && renderModerators()}
            {activeTab === 'tokens' && renderTokens()}
            {activeTab === 'locations' && (
              <LocationManagement
                onLocationCreated={(location) => {
                  showToast(`Location "${location.name}" created successfully`, 'success');
                }}
              />
            )}
            {activeTab === 'create-events' && (
              <EventManagement
                onEventCreated={(event) => {
                  showToast(`Event "${event.title}" created successfully`, 'success');
                  loadAllEvents();
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;