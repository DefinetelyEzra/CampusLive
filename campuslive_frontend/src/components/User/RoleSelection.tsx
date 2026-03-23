import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoleStore } from '../../stores/roleStore';
import { useToast } from '../toastContext';
import { ArrowLeft, Shield, Camera, Eye, Key, User, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    currentRole,
    isLoading,
    fetchUserRoles,
    fetchCurrentRole,
    registerRole,
    deregisterRole,
    clearError
  } = useRoleStore();

  const [selectedRole, setSelectedRole] = useState<string>('');
  const [moderatorToken, setModeratorToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showDeregisterConfirm, setShowDeregisterConfirm] = useState(false);
  const [animateCards, setAnimateCards] = useState(false);

  useEffect(() => {
    fetchUserRoles();
    fetchCurrentRole();
    // Trigger card animation after component mounts
    setTimeout(() => setAnimateCards(true), 200);
  }, [fetchUserRoles, fetchCurrentRole]);

  const validateModeratorToken = (raw: string): string => {
    const token = raw.trim();
    if (!token) {
      showToast('Moderator token is required', 'error');
      throw new Error('NO_MODERATOR_TOKEN');
    }
    return token;
  };

  const handleRegistrationError = (errorMsg = '') => {
    const normalized = errorMsg;
    const mappings: { test: (m: string) => boolean; message: string; duration?: number }[] = [
      { test: (m) => m.includes('expired'), message: 'This moderator token has expired. Please request a new token from an administrator.', duration: 6000 },
      { test: (m) => m.includes('already been used by another user'), message: 'This token has already been claimed by another user.' },
      { test: (m) => m.includes('Invalid moderator token'), message: 'Invalid moderator token. Please check and try again.' },
      { test: (m) => m.includes('must deregister'), message: normalized }
    ];

    const found = mappings.find((map) => map.test(normalized));
    if (found) {
      showToast(found.message || normalized, 'error', found.duration);
    } else {
      showToast(normalized || 'Role registration failed', 'error');
    }
  };

  const handleRoleSelection = async (): Promise<void> => {
    if (!selectedRole) return;

    clearError();

    try {
      let token: string | undefined;

      if (selectedRole === 'MODERATOR') {
        token = validateModeratorToken(moderatorToken);
        console.log('Sending token:', token);
        console.log('Token length:', token.length);
        await registerRole(selectedRole, token);
      } else {
        await registerRole(selectedRole);
      }

      showToast(`Successfully registered as ${selectedRole}`, 'success');
      navigate('/map');
    } catch (error) {
      console.error('Role registration failed:', error);

      if (error instanceof Error) {
        handleRegistrationError(error.message);
      } else {
        showToast('Role registration failed', 'error');
      }
    }
  };

  const handleDeregister = async () => {
    if (!currentRole) return;

    try {
      await deregisterRole(currentRole.roleType);
      setShowDeregisterConfirm(false);
      showToast(`Successfully deregistered from ${currentRole.roleType}`, 'success');
    } catch (error) {
      console.error('Deregistration failed:', error);
      if (error instanceof Error) {
        showToast(error.message || 'Deregistration failed', 'error');
      } else {
        showToast('Deregistration failed', 'error');
      }
    }
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    setShowTokenInput(role === 'MODERATOR');
    if (role !== 'MODERATOR') {
      setModeratorToken('');
    }
  };

  const canSelectRole = !currentRole || (currentRole.expiresAt && new Date(currentRole.expiresAt) < new Date());

  const roleDescriptions = {
    WATCHER: {
      icon: Eye,
      title: 'Watcher',
      subtitle: 'The Observer',
      description: 'See everything, everywhere, all at once. Watch live events across campus from anywhere.',
      features: ['View all live events', 'Access event media', 'Real-time updates', 'No location restrictions'],
      color: 'from-blue-500 to-cyan-400',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      accentColor: 'bg-blue-500'
    },
    POSTER: {
      icon: Camera,
      title: 'Poster',
      subtitle: 'The Creator',
      description: 'Capture moments that matter. Share your perspective with the campus community.',
      features: ['Join live events', 'Upload photos/videos', 'Location verification required', 'One event at a time'],
      color: 'from-emerald-500 to-green-400',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      accentColor: 'bg-emerald-500'
    },
    MODERATOR: {
      icon: Shield,
      title: 'Moderator',
      subtitle: 'The Guardian',
      description: 'Shape experiences. Control the narrative. Guide the community with wisdom.',
      features: ['Set event boundaries', 'Manage participants', 'End events', 'Remove users', 'Location control'],
      color: 'from-purple-500 to-violet-400',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      accentColor: 'bg-purple-500'
    }
  };

  const roleButtonLabel = selectedRole
    ? roleDescriptions[selectedRole as keyof typeof roleDescriptions]?.title || 'Role'
    : 'Role';

  const renderCurrentRoleSection = () => {
    if (!currentRole) return null;

    const roleInfo = roleDescriptions[currentRole.roleType];
    const IconComponent = roleInfo?.icon || User;

    return (
      <div className={`mb-6 sm:mb-8 p-4 sm:p-6 ${roleInfo?.bgColor || 'bg-gray-50'} border-2 ${roleInfo?.borderColor || 'border-gray-200'} rounded-2xl shadow-lg relative overflow-hidden`}>
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0 mb-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className={`h-12 w-12 sm:h-16 sm:w-16 ${roleInfo?.accentColor || 'bg-gray-500'} rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                <IconComponent className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                  <h3 className="text-base sm:text-xl font-bold text-gray-900">Active Role</h3>
                </div>
                <p className={`text-sm sm:text-lg font-semibold ${roleInfo?.textColor || 'text-gray-700'} truncate`}>
                  {currentRole.roleType} • {roleInfo?.subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeregisterConfirm(true)}
              className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 hover:text-red-800 bg-white border border-red-300 rounded-xl hover:bg-red-50 transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto flex-shrink-0"
            >
              <X className="h-4 w-4 flex-shrink-0" />
              <span>Deregister</span>
            </button>
          </div>
          {currentRole.expiresAt && (
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>Expires: {new Date(currentRole.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDeregisterModal = () => {
    if (!showDeregisterConfirm || !currentRole) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl transform transition-all">
          <div className="text-center mb-6">
            <div className="h-14 w-14 sm:h-16 sm:w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Confirm Deregistration</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Are you sure you want to deregister from your current <strong>{currentRole.roleType}</strong> role?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setShowDeregisterConfirm(false)}
              className="w-full px-6 py-3 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleDeregister}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isLoading ? 'Deregistering...' : 'Deregister'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => navigate('/map')}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
              aria-label="Back to Map"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 group-hover:-translate-x-1 transition-transform duration-200 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Back</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900">Role Selection</h1>
            </div>
            <div className="w-10 sm:w-24"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="relative mb-6 sm:mb-8">
            <div className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 mx-auto mb-4 sm:mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 rounded-full animate-pulse opacity-20"></div>
              <div className="relative h-full w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                <Eye className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-white animate-pulse" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 mb-3 sm:mb-4 px-4">
              What Are You?
            </h1>
            <p className="text-sm sm:text-base lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed px-4">
              Choose your role in the CampusLive ecosystem. Each role unlocks unique powers and responsibilities.
            </p>
          </div>
        </div>

        {/* Current Active Role (if exists) */}
        {renderCurrentRoleSection()}

        {/* Role Selection */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 lg:p-8 border border-white/20">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">Choose Your Path</h2>

          {isLoading && (
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0"></div>
                <p className="text-sm sm:text-base text-blue-700 font-medium">Loading roles...</p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            {Object.entries(roleDescriptions).map(([roleKey, roleInfo], index) => {
              const IconComponent = roleInfo.icon;
              const isSelected = selectedRole === roleKey;
              const delay = index * 100;

              return (
                <button
                  key={roleKey}
                  onClick={() => handleRoleChange(roleKey)}
                  disabled={!canSelectRole}
                  className={`group relative border-2 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 cursor-pointer transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transform hover:scale-105 active:scale-95 ${animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                    } ${isSelected
                      ? 'border-transparent bg-gradient-to-br ' + roleInfo.color + ' text-white shadow-2xl scale-105'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 shadow-lg hover:shadow-2xl'
                    } ${canSelectRole ? '' : 'opacity-50 cursor-not-allowed hover:scale-100'}`}
                  style={{ transitionDelay: `${delay}ms` }}
                  aria-label={`Select ${roleInfo.title} role`}
                >
                  <div className="text-center mb-4 sm:mb-6">
                    <div className={`h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg transition-all duration-300 ${isSelected
                      ? 'bg-white/20 backdrop-blur-sm'
                      : 'bg-gradient-to-br ' + roleInfo.color
                      }`}>
                      <IconComponent className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                    </div>
                    <h3 className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 transition-colors duration-300 ${isSelected ? 'text-white' : 'text-gray-900'
                      }`}>
                      {roleInfo.title}
                    </h3>
                    <p className={`text-xs sm:text-sm font-medium mb-2 sm:mb-3 transition-colors duration-300 ${isSelected ? 'text-white/80' : roleInfo.textColor
                      }`}>
                      {roleInfo.subtitle}
                    </p>
                  </div>

                  <p className={`text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed transition-colors duration-300 ${isSelected ? 'text-white/90' : 'text-gray-600'
                    }`}>
                    {roleInfo.description}
                  </p>

                  <ul className="space-y-1.5 sm:space-y-2">
                    {roleInfo.features.map((feature, featureIndex) => (
                      <li key={`${roleKey}-feature-${featureIndex}`} className={`flex items-start text-xs transition-colors duration-300 ${isSelected ? 'text-white/80' : 'text-gray-500'
                        }`}>
                        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-2 sm:mr-3 mt-1 flex-shrink-0 transition-colors duration-300 ${isSelected ? 'bg-white/60' : 'bg-gradient-to-r ' + roleInfo.color
                          }`}></div>
                        <span className="flex-1">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isSelected && (
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/10 to-transparent opacity-50 animate-pulse pointer-events-none"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Moderator Token Input */}
          {showTokenInput && (
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl shadow-lg animate-fadeIn">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <Key className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-yellow-800">Moderator Access Required</h4>
              </div>
              <p className="text-xs sm:text-sm text-yellow-700 mb-4 leading-relaxed">
                Enter the 9-character moderator token provided by an administrator. This grants you special privileges to manage events and participants.
              </p>
              <input
                type="text"
                placeholder="MODXXXXXX"
                value={moderatorToken}
                onChange={(e) => setModeratorToken(e.target.value)}
                maxLength={9}
                className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all duration-200 text-center font-mono text-base sm:text-lg bg-white/50 backdrop-blur-sm"
                aria-label="Moderator token input"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center space-y-reverse space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => navigate('/map')}
              className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 text-center"
              aria-label="Cancel role selection"
            >
              Cancel
            </button>
            <button
              onClick={handleRoleSelection}
              disabled={!selectedRole || isLoading || (selectedRole === 'MODERATOR' && !moderatorToken.trim())}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl sm:rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:hover:scale-100"
              aria-label="Register selected role"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Registering...</span>
                </div>
              ) : (
                `Become ${roleButtonLabel}`
              )}
            </button>
          </div>
        </div>

        {renderDeregisterModal()}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RoleSelection;