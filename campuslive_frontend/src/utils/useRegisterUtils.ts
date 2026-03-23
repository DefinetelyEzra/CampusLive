import { useState, useEffect } from 'react';
import type { RegisterData } from '../types';

export const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemDark);

        setIsDarkMode(shouldUseDark);
        document.documentElement.classList.toggle('dark', shouldUseDark);
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDarkMode;
        setIsDarkMode(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', newTheme);
    };

    return { isDarkMode, toggleTheme };
};

export const useFormValidation = () => {
    const validateForm = (formData: RegisterData, confirmPassword: string) => {
        const newErrors: Record<string, string> = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!formData.email.endsWith('@pau.edu.ng')) {
            newErrors.email = 'Please use your Pan-Atlantic University email (@pau.edu.ng)';
        } else if (!/^[a-zA-Z0-9._%+-]+@pau\.edu\.ng$/.test(formData.email)) {
            newErrors.email = 'Invalid PAU email format';
        }

        if (!formData.username) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        } else if (formData.username.length > 50) {
            newErrors.username = 'Username must be at most 50 characters';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        return newErrors;
    };

    const getPasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[@$!%*?&]/.test(password)) strength++;
        return strength;
    };

    return { validateForm, getPasswordStrength };
};

export const getInputStyles = (isDarkMode: boolean, hasError: boolean) => {
    const baseStyles = "w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2";

    if (hasError) {
        return isDarkMode
            ? `${baseStyles} bg-slate-700 border-red-600 text-white placeholder-gray-400 focus:border-red-500 focus:ring-red-500/20 focus:ring-offset-slate-800`
            : `${baseStyles} bg-white border-red-300 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20 focus:ring-offset-white`;
    }

    return isDarkMode
        ? `${baseStyles} bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800`
        : `${baseStyles} bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:ring-teal-500/20 focus:ring-offset-white`;
};

export const getPasswordInputStyles = (isDarkMode: boolean, hasError: boolean) => {
    const baseStyles = "w-full pl-10 pr-12 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2";

    if (hasError) {
        return isDarkMode
            ? `${baseStyles} bg-slate-700 border-red-600 text-white placeholder-gray-400 focus:border-red-500 focus:ring-red-500/20 focus:ring-offset-slate-800`
            : `${baseStyles} bg-white border-red-300 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20 focus:ring-offset-white`;
    }

    return isDarkMode
        ? `${baseStyles} bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800`
        : `${baseStyles} bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:ring-teal-500/20 focus:ring-offset-white`;
};

export const getPasswordStrengthColor = (strength: number) => {
    if (strength <= 2) return 'text-red-500';
    if (strength <= 3) return 'text-yellow-500';
    return 'text-green-500';
};

export const getPasswordStrengthText = (strength: number) => {
    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    if (strength <= 4) return 'Strong';
    return 'Very Strong';
};

export const getPasswordStrengthBarColor = (strength: number, index: number, isDarkMode: boolean) => {
    if (index >= strength) {
        return isDarkMode ? 'bg-slate-600' : 'bg-gray-200';
    }

    if (strength <= 2) return 'bg-red-500';
    if (strength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
};