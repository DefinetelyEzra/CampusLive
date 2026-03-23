import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastContextValue = {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return ctx;
};
