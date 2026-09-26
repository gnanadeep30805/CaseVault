import clsx from 'clsx';
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import Button from './Button.jsx';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
    return (
        <div className={clsx('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-700/50 dark:text-ink-300">
                <Icon size={22} aria-hidden="true" />
            </span>
            <div>
                <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{title}</p>
                {description ? <p className="mx-auto mt-1 max-w-md text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

export function ErrorState({ title = 'Unable to load data', message, onRetry, className }) {
    return (
        <div className={clsx('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)} role="alert">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <TriangleAlert size={22} aria-hidden="true" />
            </span>
            <div>
                <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{title}</p>
                {message ? <p className="mx-auto mt-1 max-w-md text-xs text-ink-500 dark:text-ink-400">{message}</p> : null}
            </div>
            {onRetry ? <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>Retry</Button> : null}
        </div>
    );
}

export function PermissionNotice({ message, className }) {
    return (
        <div className={clsx('flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning', className)} role="note">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
}

export function InlineError({ message }) {
    if (!message) return null;
    return (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger" role="alert">
            <TriangleAlert size={13} aria-hidden="true" />
            {message}
        </p>
    );
}

export function InlineSuccess({ message }) {
    if (!message) return null;
    return <p className="mt-1.5 text-xs font-semibold text-success" role="status">{message}</p>;
}
