import React, { useState, useEffect } from 'react';
import { Mail, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useToast } from '../toastContext';
import apiService from '../../services/api';

interface ForgotPasswordProps {
    onBackToLogin: () => void;
}

// Helper to get theme-aware classes (reduces ternaries)
const getThemeClass = (light: string, dark: string, isDark: boolean) =>
    isDark ? dark : light;

// Reusable UI pieces
const ThemeToggle: React.FC<{ isDark: boolean; onToggle: () => void }> = ({
    isDark,
    onToggle,
}) => (
    <button
        onClick={onToggle}
        className={`fixed top-6 right-6 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 ${isDark
                ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
                : 'bg-white text-blue-600 hover:bg-gray-50'
            }`}
    >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
);

const SuccessState: React.FC<{
    email: string;
    isDark: boolean;
    onBack: () => void;
}> = ({ email, isDark, onBack }) => (
    <div className="text-center space-y-6">
        <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${isDark ? 'bg-teal-900/50' : 'bg-teal-50'
                }`}
        >
            <Mail className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>

        <div>
            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Reset link sent
            </h2>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                If <span className="font-medium">{email}</span> is registered, you'll receive a
                link shortly. Check your spam folder if it doesn't arrive within a few minutes.
            </p>
        </div>

        <button
            type="button"
            onClick={onBack}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 border-2 hover:scale-[1.02] active:scale-[0.98] ${isDark
                    ? 'border-slate-600 text-blue-300 hover:bg-slate-700/50 hover:border-blue-400'
                    : 'border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300'
                }`}
        >
            Back to Sign In
        </button>
    </div>
);

const ForgotPasswordForm: React.FC<{
    email: string;
    error: string;
    status: 'idle' | 'loading' | 'sent';
    isDark: boolean;
    onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    onBack: () => void;
}> = ({ email, error, status, isDark, onEmailChange, onSubmit, onBack }) => (
    <form onSubmit={onSubmit} className="space-y-6">
        <div>
            <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Enter your PAU email address and we'll send you a link to reset your password.
            </p>

            <label
                htmlFor="reset-email"
                className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
            >
                Email Address
            </label>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={onEmailChange}
                    placeholder="yourname@pau.edu.ng"
                    disabled={status === 'loading'}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${isDark
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-offset-white'
                        } disabled:cursor-not-allowed`}
                />
            </div>
        </div>

        {error && (
            <div
                className={`p-4 rounded-xl border ${isDark
                        ? 'bg-red-900/50 border-red-800 text-red-300'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
            >
                <p className="text-sm">{error}</p>
            </div>
        )}

        <button
            type="submit"
            disabled={status === 'loading'}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 shadow-lg ${isDark
                    ? 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-slate-800 disabled:from-gray-600 disabled:to-gray-600'
                    : 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-400'
                } disabled:hover:scale-100 disabled:cursor-not-allowed`}
        >
            {status === 'loading' ? (
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                    Sending link...
                </div>
            ) : (
                'Send Reset Link'
            )}
        </button>

        <button
            type="button"
            onClick={onBack}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 border-2 hover:scale-[1.02] active:scale-[0.98] ${isDark
                    ? 'border-slate-600 text-blue-300 hover:bg-slate-700/50 hover:border-blue-400'
                    : 'border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300'
                }`}
        >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
        </button>
    </form>
);

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
    const [error, setError] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const { showToast } = useToast();

    // Theme setup (unchanged)
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemDark);

        setIsDarkMode(shouldUseDark);
        document.documentElement.classList.toggle('dark', shouldUseDark);
    }, []);

    const toggleTheme = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', next);
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (error) setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }

        setStatus('loading');

        try {
            await apiService.forgotPassword(email.trim().toLowerCase());
        } catch {
            // Security: always show success to prevent email enumeration
        }

        setStatus('sent');
        showToast('Reset link sent! Check your inbox.', 'success');
    };

    const backgroundClass = getThemeClass(
        'bg-gradient-to-br from-blue-50 via-teal-50 to-blue-100',
        'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900',
        isDarkMode
    );

    return (
        <div className={`min-h-screen transition-colors duration-300 ${backgroundClass}`}>
            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse ${isDarkMode ? 'bg-blue-400' : 'bg-blue-300'
                        }`}
                />
                <div
                    className={`absolute top-3/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10 animate-pulse delay-1000 ${isDarkMode ? 'bg-teal-400' : 'bg-teal-300'
                        }`}
                />
            </div>

            <ThemeToggle isDark={isDarkMode} onToggle={toggleTheme} />

            <div className="relative flex items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <div className="flex items-center justify-center mb-6">
                            <img
                                src="/src/assets/logo.png"
                                alt="CampusLive Logo"
                                className="mx-auto mb-0 w-48 h-auto"
                            />
                        </div>
                        <h1
                            className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}
                        >
                            CampusLive
                        </h1>
                        <p
                            className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'
                                }`}
                        >
                            Pan-Atlantic University
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {status === 'sent' ? 'Check your inbox' : 'Reset your password'}
                        </p>
                    </div>

                    {/* Card */}
                    <div
                        className={`backdrop-blur-sm rounded-3xl shadow-2xl p-8 transition-all duration-300 border ${isDarkMode
                                ? 'bg-slate-800/90 border-slate-700 shadow-blue-900/20'
                                : 'bg-white/90 border-white/20 shadow-blue-200/30'
                            }`}
                    >
                        {status === 'sent' ? (
                            <SuccessState
                                email={email}
                                isDark={isDarkMode}
                                onBack={onBackToLogin}
                            />
                        ) : (
                            <ForgotPasswordForm
                                email={email}
                                error={error}
                                status={status}
                                isDark={isDarkMode}
                                onEmailChange={handleEmailChange}
                                onSubmit={handleSubmit}
                                onBack={onBackToLogin}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="text-center">
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Campus location: Km 52 Lekki - Epe Expressway, Lagos
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;