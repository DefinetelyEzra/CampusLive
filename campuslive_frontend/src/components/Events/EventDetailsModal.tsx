import React, { useState, useEffect } from 'react';
import { X, MapPin, Users, Clock, Camera, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useSocketStore } from '../../stores/socketStore';
import { useRoleStore } from '../../stores/roleStore';
import { useToast } from '../toastContext';
import type { Event, Post } from '../../types';
import apiService from '../../services/api';
import { MediaUploadButton } from '../MediaUpload/MediaUploadButton';
import { LiveFeed } from './LiveFeed';

interface EventDetailsModalProps {
  event: Event | null;
  onClose: () => void;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, onClose }) => {
  const { socket } = useSocketStore();
  const { currentRole } = useRoleStore();
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isUserAttending, setIsUserAttending] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'feed' | 'upload'>('details');
  const [uploading, setUploading] = useState(false);
  const [postContent, setPostContent] = useState('');

  useEffect(() => {
    // Ensure socket is connected when modal opens
    const { connectSocket } = useSocketStore.getState();
    if (!socket) {
      console.log('Socket not found, attempting to connect...');
      connectSocket();
    }
  }, [socket]);

  useEffect(() => {
    if (currentRole?.roleType === 'POSTER' || currentRole?.roleType === 'MODERATOR') {
      getCurrentLocation();
    }
  }, [currentRole]);

  useEffect(() => {
    // Check if user is attending this event
    const checkAttendance = async () => {
      if (event) {
        try {
          const response = await apiService.getMyAttendances();
          if (response?.success && response.data) {
            const attending = response.data.some((a) => a.eventId === event.id);
            setIsUserAttending(attending);

            // Switch to feed tab if user is attending
            if (attending) {
              setActiveTab('feed');
            }
          } else {
            setIsUserAttending(false);
          }
        } catch {
          setIsUserAttending(false);
        }
      }
    };
    checkAttendance();
  }, [event]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by this browser');
      return;
    }

    // Check permission first
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setLocationError('Geolocation permission denied. Please enable location access in your browser settings.');
          return;
        }
        requestLocation();
      });
    } else {
      requestLocation();
    }

    function requestLocation() {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationError(null);
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError('Location access denied. Please enable location in browser settings.');
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError('Location information unavailable');
              break;
            case error.TIMEOUT:
              setLocationError('Location request timed out');
              break;
            default:
              setLocationError('Failed to get location');
              break;
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    }
  };

  const validateAccessKey = (isPrivate: boolean, key: string): string | null => {
    if (!isPrivate) return null;
    if (!key || key.length !== 6) {
      return 'Please enter the access key';
    }
    if (!/^[A-Z0-9]{6}$/.test(key)) {
      return 'Access key must contain only uppercase letters and numbers';
    }
    return null;
  };

  const handleJoinEvent = async () => {
    if (!currentRole || !event) {
      return;
    }

    const accessKeyError = validateAccessKey(event.isPrivate ?? false, accessKey);
    if (accessKeyError) {
      showToast(accessKeyError, 'error');
      return;
    }

    setJoining(true);

    try {
      await apiService.joinEvent(
        event.id,
        currentRole.roleType,
        userLocation || undefined,
        event.isPrivate ? accessKey : undefined
      );

      setIsUserAttending(true);
      setActiveTab('feed'); // Switch to feed after joining
      showToast(`Successfully joined event as ${currentRole.roleType}`, 'success');

      const refreshEvent = new CustomEvent('refreshEvents');
      globalThis.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Join error:', error);

      let errorMessage = 'Failed to join event';
      if (error instanceof Error) {
        if (error.message.includes('Incorrect access key') || error.message.includes('incorrect')) {
          errorMessage = 'Incorrect access key. Please check the key and try again.';
        } else if (error.message.includes('Access key required')) {
          errorMessage = 'This event requires an access key.';
        } else if (error.message.includes('Invalid access key format')) {
          errorMessage = 'Invalid access key format. Must be 6 uppercase letters/numbers.';
        } else {
          errorMessage = error.message;
        }
      }

      showToast(errorMessage, 'error');
    } finally {
      setJoining(false);
    }
  };

  const canJoinEvent = () => {
    if (!currentRole || !event) return false;

    // Watchers can always "join" (they just view content)
    if (currentRole?.roleType === 'WATCHER') return true;

    // Posters and Moderators need location and the event to be live
    if ((currentRole?.roleType === 'POSTER' || currentRole?.roleType === 'MODERATOR')) {
      if (!userLocation) return false;
      if (!event.isLive) return false;
    }

    return true;
  };

  const handleLeaveEvent = async () => {
    if (!event) return;

    setJoining(true);
    try {
      await apiService.leaveEvent(event.id);
      showToast('Successfully left the event', 'success');
      setIsUserAttending(false);
      setActiveTab('details'); // Switch back to details
      onClose();

      // Trigger a refresh of the events list
      const refreshEvent = new CustomEvent('refreshEvents');
      globalThis.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Leave error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave event';
      showToast(`Failed to leave: ${errorMessage}`, 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (!event) return;

    setUploading(true);
    try {
      await apiService.createPost({
        content: postContent.trim() || undefined,
        locationId: event.locationId,
        eventId: event.id,
        media: file
      });

      showToast('Posted successfully!', 'success');
      setPostContent('');

      // Switch to feed to see the new post
      setActiveTab('feed');

      // Trigger feed refresh
      const refreshEvent = new CustomEvent('refreshEvents');
      globalThis.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      showToast(errorMessage, 'error');
    } finally {
      setUploading(false);
    }
  };

  const formatDateTime = (value?: string | number | Date | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const formatTime = (value?: string | number | Date | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString();
  };

  const canUploadMedia = () => {
    return isUserAttending &&
      (currentRole?.roleType === 'POSTER' || currentRole?.roleType === 'MODERATOR') &&
      event?.isLive;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">{event?.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs - Show only if user is attending */}
        {isUserAttending && (
          <div className="flex border-b bg-gray-50">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'details'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'feed'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Live Feed
            </button>
            {canUploadMedia() && (
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'upload'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <Camera className="h-4 w-4" />
                  <span>Upload</span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-6">
              {/* Event Info */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">{event?.location?.name || 'Unknown location'}</span>
                </div>

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div className="text-gray-700">
                    <span>{event?.attendeeCount || 0} currently here</span>
                    {event?.totalAttendees !== undefined && event.totalAttendees > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({event.totalAttendees} total participant{event.totalAttendees === 1 ? '' : 's'})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div className="text-gray-700">
                    <p>Started: {formatDateTime(event?.startTime)}</p>
                    {event?.endTime && (
                      <p>Ends: {formatDateTime(event.endTime)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${event?.isLive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    {event?.isLive ? 'LIVE' : 'ENDED'}
                  </span>
                </div>

                {event?.description && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{event.description}</p>
                  </div>
                )}
              </div>

              {/* Location Requirements */}
              {(currentRole?.roleType === 'POSTER' || currentRole?.roleType === 'MODERATOR') && !isUserAttending && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Location Verification Required</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        You must be physically present at the event location to join as a {currentRole.roleType.toLowerCase()}.
                      </p>
                      {locationError && (
                        <div className="mt-2">
                          <p className="text-sm text-red-600">{locationError}</p>
                          <button
                            onClick={getCurrentLocation}
                            className="text-sm text-blue-600 hover:text-blue-800 underline mt-1"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                      {userLocation && (
                        <p className="text-sm text-green-600 mt-2">
                          ✓ Location detected
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Role Status */}
              {currentRole && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-800">
                    {currentRole?.roleType === 'WATCHER' && (
                      <p>You can view all media and event updates without location restrictions.</p>
                    )}
                    {currentRole?.roleType === 'POSTER' && (
                      <p>You can upload photos and videos while attending this event. Location monitoring will be active.</p>
                    )}
                    {currentRole?.roleType === 'MODERATOR' && (
                      <p>You can manage event boundaries, participants, and end the event. Location monitoring will be active.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Media/Posts Preview */}
              {event?.posts && event.posts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recent Posts</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {event.posts.slice(0, 4).map((post: Post) => (
                      <div key={post.id} className="bg-gray-50 rounded-lg p-3">
                        {post.mediaUrl ? (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Camera className="h-4 w-4" />
                            <span>Media post</span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700">{post.content}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          by {post.user.username} • {formatTime(post.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Feed Tab */}
          {activeTab === 'feed' && event && (
            <LiveFeed eventId={event.id} eventTitle={event.title} />
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && canUploadMedia() && event && (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ImageIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Share Your Experience</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Capture and share photos or videos from this event. Your posts will be visible in the live feed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Caption Input */}
              <div>
                <label htmlFor="post-content" className="block text-sm font-medium text-gray-700 mb-2">
                  Add a caption (optional)
                </label>
                <textarea
                  id="post-content"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's happening at this event?"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {postContent.length}/500 characters
                </p>
              </div>

              {/* Upload Button */}
              <div className="space-y-4">
                <MediaUploadButton
                  onFileSelect={handleMediaUpload}
                  disabled={uploading}
                  eventId={event.id}
                  compact={false}
                />

                {uploading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <span className="ml-3 text-gray-600">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Recent Uploads Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Tips for Great Posts</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Keep videos under 50MB for faster uploads</li>
                  <li>• Photos are automatically optimized for quality</li>
                  <li>• Stay within the event location to maintain your connection</li>
                  <li>• Your posts will appear immediately in the live feed</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex space-x-3 w-full">
            {!isUserAttending && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>

                {!currentRole && (
                  <button
                    onClick={() => globalThis.location.href = '/roles'}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Select Role
                  </button>
                )}

                {currentRole && canJoinEvent() && (
                  <div className="flex flex-col space-y-3 flex-1">
                    {event?.isPrivate && (
                      <div className="w-full">
                        <label htmlFor="access-key" className="block text-sm font-medium text-gray-700 mb-1">
                          Access Key Required
                        </label>
                        <input
                          id="access-key"
                          type="text"
                          value={accessKey}
                          onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                          placeholder="Enter 6-character key"
                          maxLength={6}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono text-center tracking-wider text-lg ${accessKey.length === 6
                            ? 'border-green-300 focus:ring-green-500 bg-green-50'
                            : 'border-gray-300 focus:ring-blue-500'
                            }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This is a private event. Enter the access key to join.
                        </p>
                      </div>
                    )}
                    <button
                      onClick={handleJoinEvent}
                      disabled={joining || (event?.isPrivate && accessKey.length !== 6)}
                      className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {joining ? 'Joining...' : `Join as ${currentRole.roleType}`}
                    </button>
                  </div>
                )}
              </>
            )}

            {isUserAttending && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleLeaveEvent}
                  disabled={joining}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors ml-auto"
                >
                  {joining ? 'Leaving...' : 'Leave Event'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;