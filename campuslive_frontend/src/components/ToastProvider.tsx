import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext } from './toastContext';
import type { ToastContextValue, ToastType } from './toastContext';

type Toast = {
    readonly id: string;
    readonly message: string;
    readonly type: ToastType;
    readonly duration: number;
    readonly exiting?: boolean;
};

const DEFAULT_DURATION = 6000; // visible time before fade begins
const FADE_OUT_MS = 250; // fade-out animation duration
const AUTO_CLEAN_MS = 15000; // safety clean

const ToastItem: React.FC<{ readonly t: Toast; readonly onDismiss: (id: string, fast?: boolean) => void }> = ({ t, onDismiss }) => {
    const exitClass = t.exiting
        ? 'opacity-0 -translate-y-1 scale-98 pointer-events-none'
        : 'opacity-100 translate-y-0 scale-100';

    return (
        <div
            role="status"
            className={`w-64 rounded-lg px-3 py-2 transform transition-all border-0 outline-none ring-0
                ${t.type === 'success' ? 'bg-green-600 text-white' : ''}
                ${t.type === 'error' ? 'bg-red-600 text-white' : ''}
                ${t.type === 'info' ? 'bg-slate-800 text-white' : ''}
                ${exitClass}`}
            style={{
                transitionDuration: `${FADE_OUT_MS}ms`,
                boxShadow:
                    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }}
        >
            <div className="flex items-start gap-2 px-1 py-1">
                <div className="flex-1 text-sm break-words">{t.message}</div>
                <button
                    onClick={() => onDismiss(t.id, true)}
                    aria-label="dismiss"
                    className="ml-1 text-white/80 hover:text-white outline-none ring-0 focus:outline-none"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

const ToastListPortal: React.FC<{ readonly toasts: Toast[]; readonly onDismiss: (id: string, fast?: boolean) => void }> = ({ toasts, onDismiss }) => {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div aria-live="polite" className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
            {toasts.map((t) => (
                <ToastItem key={t.id} t={t} onDismiss={onDismiss} />
            ))}
        </div>,
        document.body
    );
};

export default function ToastProvider({ children }: { readonly children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToastById = (idToRemove: string, setToastsFn: React.Dispatch<React.SetStateAction<Toast[]>>) => {
        setToastsFn((prev) => prev.filter((t) => t.id !== idToRemove));
    };

    const scheduleRemove = useCallback((id: string, delay: number) => {
        setTimeout(() => removeToastById(id, setToasts), delay);
    }, []);

    const startExit = useCallback((id: string, fast = false) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        const removeDelay = fast ? 120 : FADE_OUT_MS + 40;
        scheduleRemove(id, removeDelay);
    }, [scheduleRemove]);

    const dismiss = useCallback((id: string, fast = false) => {
        startExit(id, fast);
    }, [startExit]);

    const showToast = useCallback(
        (message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const t: Toast = { id, message, type, duration, exiting: false };

            // prepend so newest appears on top
            setToasts((prev) => [t, ...prev]);

            // schedule fade-out after `duration`
            setTimeout(() => startExit(id), duration);
        },
        [startExit]
    );

    // memoize context so it doesn't change each render
    const ctxValue = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

    useEffect(() => {
        const timer = setInterval(() => {
            setToasts((prev) => prev.filter(Boolean));
        }, AUTO_CLEAN_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <ToastContext.Provider value={ctxValue}>
            {children}
            <ToastListPortal toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}
