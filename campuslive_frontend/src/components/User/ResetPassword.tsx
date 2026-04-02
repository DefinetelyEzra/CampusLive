import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Moon, Sun, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../toastContext';
import apiService from '../../services/api';

// Custom hook for theme management
const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

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

    return { isDarkMode, toggleTheme };
};

// Helper components
const StrengthHint: React.FC<{ ok: boolean; dark: boolean; label: string }> = ({
    ok,
    dark,
    label,
}) => {
    let checkColor = '';
    let textColor = '';

    if (ok) {
        checkColor = dark ? 'text-teal-400' : 'text-teal-600';
        textColor = dark ? 'text-teal-400' : 'text-teal-600';
    } else {
        checkColor = dark ? 'text-gray-500' : 'text-gray-400';
        textColor = dark ? 'text-gray-500' : 'text-gray-400';
    }

    return (
        <div className="flex items-center gap-2">
            {ok ? (
                <CheckCircle className={`h-3.5 w-3.5 flex-shrink-0 ${checkColor}`} />
            ) : (
                <XCircle className={`h-3.5 w-3.5 flex-shrink-0 ${checkColor}`} />
            )}
            <span className={`text-xs ${textColor}`}>{label}</span>
        </div>
    );
};

const PasswordStrength: React.FC<{ password: string; dark: boolean }> = ({ password, dark }) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (password.length === 0) return null;

    return (
        <div className="space-y-1 pt-1">
            <StrengthHint ok={hasMinLength} dark={dark} label="At least 8 characters" />
            <StrengthHint ok={hasUppercase} dark={dark} label="One uppercase letter" />
            <StrengthHint ok={hasNumber} dark={dark} label="One number" />
        </div>
    );
};

const ConfirmMatch: React.FC<{ password: string; confirm: string; dark: boolean }> = ({
    password,
    confirm,
    dark,
}) => {
    const matches = password === confirm && confirm.length > 0;
    if (confirm.length === 0) return null;

    return (
        <div className="space-y-1 pt-1">
            <StrengthHint ok={matches} dark={dark} label="Passwords match" />
        </div>
    );
};

// Success screen
const SuccessScreen: React.FC<{ dark: boolean }> = ({ dark }) => (
    <div className="text-center space-y-6">
        <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${dark ? 'bg-teal-900/50' : 'bg-teal-50'
                }`}
        >
            <CheckCircle className={`w-8 h-8 ${dark ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>
        <div>
            <h2 className={`text-xl font-semibold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
                Password updated
            </h2>
            <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                Your password has been reset successfully. Redirecting you to the login page…
            </p>
        </div>
    </div>
);

// Reset password form
interface ResetPasswordFormProps {
    isDarkMode: boolean;
    onSubmit: (password: string) => Promise<void>;
    isLoading: boolean;
    errorMsg: string;
    clearError: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
    isDarkMode,
    onSubmit,
    isLoading,
    errorMsg,
    clearError,
}) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (password.length < 8) {
            // Error will be shown via errorMsg prop
            onSubmit(password); // parent will handle validation
            return;
        }
        if (password !== confirmPassword) {
            onSubmit(password);
            return;
        }
        await onSubmit(password);
    };

    // Style helpers
    const inputClass = `w-full pl-10 pr-10 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${isDarkMode
            ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800'
            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-offset-white'
        } disabled:cursor-not-allowed`;

    const primaryBtn = `w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 shadow-lg ${isDarkMode
            ? 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-slate-800 disabled:from-gray-600 disabled:to-gray-600'
            : 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-400'
        } disabled:hover:scale-100 disabled:cursor-not-allowed`;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* New password */}
            <div className="space-y-2">
                <label
                    htmlFor="new-password"
                    className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                >
                    New Password
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            clearError();
                        }}
                        placeholder="Min. 8 characters"
                        disabled={isLoading}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        {showPassword ? (
                            <EyeOff
                                className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            />
                        ) : (
                            <Eye
                                className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            />
                        )}
                    </button>
                </div>
                <PasswordStrength password={password} dark={isDarkMode} />
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
                <label
                    htmlFor="confirm-password"
                    className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                >
                    Confirm Password
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            clearError();
                        }}
                        placeholder="Re-enter your password"
                        disabled={isLoading}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        {showConfirm ? (
                            <EyeOff
                                className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            />
                        ) : (
                            <Eye
                                className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            />
                        )}
                    </button>
                </div>
                <ConfirmMatch password={password} confirm={confirmPassword} dark={isDarkMode} />
            </div>

            {/* Error banner */}
            {errorMsg && (
                <div
                    className={`p-4 rounded-xl border ${isDarkMode
                            ? 'bg-red-900/50 border-red-800 text-red-300'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                >
                    <p className="text-sm">{errorMsg}</p>
                </div>
            )}

            <button type="submit" disabled={isLoading} className={primaryBtn}>
                {isLoading ? (
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                        Resetting password...
                    </div>
                ) : (
                    'Reset Password'
                )}
            </button>
        </form>
    );
};

// Main component
const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { isDarkMode, toggleTheme } = useTheme();

    const token = searchParams.get('token') ?? '';

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Redirect if no token
    useEffect(() => {
        if (!token) {
            navigate('/', { replace: true });
        }
    }, [token, navigate]);

    const handleReset = async (password: string) => {
        // Client-side validation
        if (password.length < 8) {
            setErrorMsg('Password must be at least 8 characters');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            await apiService.resetPassword(token, password);
            setStatus('success');
            showToast('Password reset! Redirecting to login...', 'success');
            setTimeout(() => navigate('/', { replace: true }), 2500);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            setErrorMsg(message);
            setStatus('error');
            showToast(message, 'error');
        }
    };

    const clearError = () => {
        if (errorMsg) setErrorMsg('');
        if (status === 'error') setStatus('idle');
    };

    const cardClass = `backdrop-blur-sm rounded-3xl shadow-2xl p-8 transition-all duration-300 border ${isDarkMode
            ? 'bg-slate-800/90 border-slate-700 shadow-blue-900/20'
            : 'bg-white/90 border-white/20 shadow-blue-200/30'
        }`;

    return (
        <div
            className={`min-h-screen transition-colors duration-300 ${isDarkMode
                    ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'
                    : 'bg-gradient-to-br from-blue-50 via-teal-50 to-blue-100'
                }`}
        >
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

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className={`fixed top-6 right-6 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 ${isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-blue-600 hover:bg-gray-50'
                    }`}
            >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative flex items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <img src="/src/assets/logo.png" alt="CampusLive Logo" className="mx-auto mb-0 w-48 h-auto" />
                        <h1 className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            CampusLive
                        </h1>
                        <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                            Pan-Atlantic University
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {status === 'success' ? 'All done!' : 'Choose a new password'}
                        </p>
                    </div>

                    {/* Card */}
                    <div className={cardClass}>
                        {status === 'success' ? (
                            <SuccessScreen dark={isDarkMode} />
                        ) : (
                            <ResetPasswordForm
                                isDarkMode={isDarkMode}
                                onSubmit={handleReset}
                                isLoading={status === 'loading'}
                                errorMsg={errorMsg}
                                clearError={clearError}
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

export default ResetPassword;