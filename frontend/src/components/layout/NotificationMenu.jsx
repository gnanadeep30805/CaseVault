import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck, FileText, FolderKanban, ListChecks, ShieldCheck, Trash2, User } from 'lucide-react';
import { api, unwrap } from '../../lib/apiClient.js';
import { formatRelative } from '../../lib/format.js';
import { useOnClickOutside } from '../../hooks/useResource.js';

const TYPE_ICONS = {
    task: ListChecks,
    document: FileText,
    case: FolderKanban,
    signature: User,
    security: ShieldCheck,
};

function resourceLink(notification) {
    if (!notification?.resourceId) return null;
    if (notification.resourceType === 'Document') return `/documents/${notification.resourceId}`;
    if (notification.resourceType === 'Case') return `/cases/${notification.resourceId}`;
    if (notification.resourceType === 'Task') return '/tasks';
    return null;
}

export default function NotificationMenu() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/notifications');
            const data = unwrap(response) || { items: [], unreadCount: 0 };
            setItems(Array.isArray(data.items) ? data.items : []);
            setUnreadCount(Number(data.unreadCount) || 0);
        } catch {
            setItems([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const timer = window.setInterval(load, 60000);
        return () => window.clearInterval(timer);
    }, [load]);

    useOnClickOutside(containerRef, () => setOpen(false), open);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const markRead = async (notification) => {
        if (notification.read) return;
        try {
            await api.post(`/notifications/${notification.id}/read`);
        } finally {
            load();
        }
    };

    const markAllRead = async () => {
        try {
            await api.post('/notifications/read-all');
        } finally {
            load();
        }
    };

    const remove = async (notification) => {
        try {
            await api.delete(`/notifications/${notification.id}`);
        } finally {
            load();
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="cv-btn-ghost relative rounded-lg p-2"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={open}
                aria-haspopup="true"
            >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border cv-divider bg-white shadow-overlay dark:bg-ink-800" role="dialog" aria-label="Notifications">
                    <div className="flex items-center justify-between border-b cv-divider px-4 py-2.5">
                        <p className="text-sm font-bold text-ink-900 dark:text-ink-50">Notifications</p>
                        <button type="button" onClick={markAllRead} className="cv-btn-ghost cv-btn-sm" disabled={unreadCount === 0}>
                            <CheckCheck size={13} aria-hidden="true" />
                            Mark all read
                        </button>
                    </div>
                    <ul className="max-h-80 divide-y cv-divider overflow-y-auto cv-scroll">
                        {loading ? (
                            <li className="px-4 py-6 text-center text-xs text-ink-500 dark:text-ink-400">Loading notifications…</li>
                        ) : items.length === 0 ? (
                            <li className="px-4 py-8 text-center">
                                <Bell size={20} className="mx-auto text-ink-400" aria-hidden="true" />
                                <p className="mt-2 text-xs font-semibold text-ink-600 dark:text-ink-300">No notifications</p>
                                <p className="mt-1 text-[0.7rem] text-ink-500 dark:text-ink-400">Task updates, shares and signature requests appear here.</p>
                            </li>
                        ) : (
                            items.map((notification) => {
                                const Icon = TYPE_ICONS[notification.type] || Bell;
                                const to = resourceLink(notification);
                                return (
                                    <li key={notification.id} className={clsx('px-4 py-3', !notification.read && 'bg-brand-500/5')}>
                                        <div className="flex items-start gap-2.5">
                                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
                                                <Icon size={14} aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-ink-900 dark:text-ink-50">{notification.title}</p>
                                                <p className="mt-0.5 text-[0.72rem] leading-snug text-ink-600 dark:text-ink-300">{notification.message}</p>
                                                <p className="mt-1 text-[0.65rem] text-ink-500 dark:text-ink-400">{formatRelative(notification.createdAt)}</p>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                    {to ? (
                                                        <Link to={to} onClick={() => setOpen(false)} className="cv-btn-secondary cv-btn-sm">
                                                            Open
                                                        </Link>
                                                    ) : null}
                                                    {!notification.read ? (
                                                        <button type="button" className="cv-btn-ghost cv-btn-sm" onClick={() => markRead(notification)}>
                                                            Mark read
                                                        </button>
                                                    ) : null}
                                                    <button type="button" className="cv-btn-ghost cv-btn-sm text-danger" onClick={() => remove(notification)} aria-label={`Delete notification ${notification.title}`}>
                                                        <Trash2 size={12} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
