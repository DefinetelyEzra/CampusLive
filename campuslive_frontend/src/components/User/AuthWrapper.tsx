import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import Login from './Login';
import Register from './Register';
import CampusMap from '../Map/CampusMap';
import LoadingScreen from '../LoadingScreen';

const AuthWrapper: React.FC = () => {
    const { isAuthenticated, isLoading, refreshUser, token } = useAuthStore();
    const [currentView, setCurrentView] = useState<'login' | 'register'>('login');

    useEffect(() => {
        // Check if user has a stored token on app load
        if (token && !isAuthenticated) {
            refreshUser();
        }
    }, [token, isAuthenticated, refreshUser]);

    // Show loading screen while checking authentication
    if (isLoading) {
        return <LoadingScreen />;
    }

    // Show campus map if authenticated
    if (isAuthenticated) {
        return <CampusMap />;
    }

    // Show authentication screens if not authenticated
    return (
        <>
            {currentView === 'login' ? (
                <Login onSwitchToRegister={() => setCurrentView('register')} />
            ) : (
                <Register onSwitchToLogin={() => setCurrentView('login')} />
            )}
        </>
    );
};

export default AuthWrapper;