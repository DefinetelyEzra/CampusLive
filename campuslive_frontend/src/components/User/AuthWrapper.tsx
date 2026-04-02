import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import CampusMap from '../Map/CampusMap';
import LoadingScreen from '../LoadingScreen';

type AuthView = 'login' | 'register' | 'forgot-password';

const AuthWrapper: React.FC = () => {
    const { isAuthenticated, isLoading, refreshUser, token } = useAuthStore();
    const [currentView, setCurrentView] = useState<AuthView>('login');

    useEffect(() => {
        if (token && !isAuthenticated) {
            refreshUser();
        }
    }, [token, isAuthenticated, refreshUser]);

    if (isLoading) return <LoadingScreen />;
    if (isAuthenticated) return <CampusMap />;

    return (
        <>
            {currentView === 'login' && (
                <Login
                    onSwitchToRegister={() => setCurrentView('register')}
                    onForgotPassword={() => setCurrentView('forgot-password')}
                />
            )}
            {currentView === 'register' && (
                <Register onSwitchToLogin={() => setCurrentView('login')} />
            )}
            {currentView === 'forgot-password' && (
                <ForgotPassword onBackToLogin={() => setCurrentView('login')} />
            )}
        </>
    );
};

export default AuthWrapper;