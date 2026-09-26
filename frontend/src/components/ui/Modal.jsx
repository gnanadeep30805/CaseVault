import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
    const panelRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusTarget = panelRef.current?.querySelector('input, select, textarea, button');
        focusTarget?.focus();
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    const sizeClass = size === 'lg' ? 'max-w-3xl' : size === 'sm' ? 'max-w-md' : 'max-w-xl';

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
        }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={clsx('cv-panel my-8 w-full shadow-overlay', sizeClass)}
            >
                <header className="flex items-start justify-between gap-4 border-b cv-divider px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">{title}</h2>
                        {description ? <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="cv-btn-ghost rounded-md p-1.5" aria-label="Close dialog">
                        <X size={16} aria-hidden="true" />
                    </button>
                </header>
                <div className="max-h-[70vh] overflow-y-auto px-5 py-4 cv-scroll">{children}</div>
                {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t cv-divider px-5 py-3">{footer}</footer> : null}
            </div>
        </div>,
        document.body,
    );
}
