import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const TONES = {
    success: { icon: CheckCircle2, className: 'border-success/40 bg-success/10 text-success' },
    error: { icon: CircleAlert, className: 'border-danger/40 bg-danger/10 text-danger' },
    info: { icon: Info, className: 'border-linkblue-500/40 bg-linkblue-500/10 text-linkblue-500' },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback((message, tone = 'info', timeout = 5000) => {
        if (!message) return null;
        idRef.current += 1;
        const id = idRef.current;
        setToasts((current) => [...current.slice(-3), { id, message: String(message), tone }]);
        if (timeout > 0) window.setTimeout(() => dismiss(id), timeout);
        return id;
    }, [dismiss]);

    const value = useMemo(() => ({
        push,
        dismiss,
        success: (message) => push(message, 'success'),
        error: (message) => push(message, 'error'),
        info: (message) => push(message, 'info'),
    }), [push, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
                {toasts.map((toast) => {
                    const tone = TONES[toast.tone] || TONES.info;
                    const Icon = tone.icon;
                    return (
                        <div key={toast.id} className={clsx('pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-panel backdrop-blur', tone.className)}>
                            <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p className="flex-1 text-ink-800 dark:text-ink-100">{toast.message}</p>
                            <button type="button" onClick={() => dismiss(toast.id)} className="cv-btn-ghost -mr-1 rounded p-1" aria-label="Dismiss notification">
                                <X size={14} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used inside ToastProvider');
    return context;
}
