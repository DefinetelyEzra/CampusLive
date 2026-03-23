import { useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './components/User/Login';
import Register from './components/User/Register';
import CampusMap from './components/Map/CampusMap';
import LoadingScreen from './components/LoadingScreen';
import './App.css';
import ToastProvider from './components/ToastProvider';
import { useNotifications } from './hooks/useNotifications';
import NotificationPopup from './components/NotificationPopup';
import { apiService } from './services/api';
import { useToast } from './components/toastContext';
import RoleSelection from './components/User/RoleSelection';
import AdminPanel from './components/Admin/AdminPanel';
import ModeratorPanel from './components/Moderator/ModeratorPanel';

class ErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading, refreshUser, token } = useAuthStore();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { notifications, hasPermission, requestPermission, dismissNotification } = useNotifications();

  const handleSwitchToRegister = () => navigate('/register');
  const handleSwitchToLogin = () => navigate('/login');

  useEffect(() => {
    apiService.setUnauthorizedHandler(() => {
      useAuthStore.getState().logout();

      // show friendly toast
      try {
        showToast('Session expired. Please sign in again.', 'error', 6000);
      } catch { /* ignore if toast not ready */ }

      // client-side navigate
      navigate('/login');
    });

    // cleanup on unmount
    return () => {
      apiService.setUnauthorizedHandler();
    };
  }, [navigate, showToast]);

  // Request notification permission when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasPermission) {
      // Delay request slightly to avoid overwhelming user on login
      const timer = setTimeout(() => {
        requestPermission().then(granted => {
          if (granted) {
            showToast('Notifications enabled! You\'ll be notified when events go live.', 'success');
          }
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasPermission, requestPermission, showToast]);

  useEffect(() => {
    // Check if user has a stored token on app load
    if (token && !isAuthenticated) {
      refreshUser();
    }
  }, [token, isAuthenticated, refreshUser]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app">
      {/* Render notification popups */}
      {notifications.map(notification => (
        <NotificationPopup
          key={notification.eventId}
          event={notification}
          onClose={() => dismissNotification(notification.eventId)}
          onViewEvent={(eventId) => {
            // Navigate to map and open event modal
            navigate('/map');
            // Trigger event selection via custom event
            globalThis.dispatchEvent(new CustomEvent('selectEvent', { detail: eventId }));
          }}
        />
      ))}
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/map" replace /> : <Login onSwitchToRegister={handleSwitchToRegister} />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/map" replace /> : <Register onSwitchToLogin={handleSwitchToLogin} />}
        />

        {/* Protected routes */}
        <Route
          path="/map"
          element={isAuthenticated ? <CampusMap /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/roles"
          element={isAuthenticated ? <RoleSelection /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin"
          element={isAuthenticated ? <AdminPanel /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/moderator"
          element={isAuthenticated ? <ModeratorPanel /> : <Navigate to="/login" replace />}
        />

        {/* Default redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/map" : "/login"} replace />}
        />

        {/* Catch all, redirect to appropriate page */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/map" : "/login"} replace />}
        />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;