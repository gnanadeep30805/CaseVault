export function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    if (Math.abs(diffMinutes) < 1) return 'just now';
    if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)}m ${diffMinutes < 0 ? 'from now' : 'ago'}`;
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ${diffHours < 0 ? 'from now' : 'ago'}`;
    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 30) return `${Math.abs(diffDays)}d ${diffDays < 0 ? 'from now' : 'ago'}`;
    return formatDate(value);
}

export function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / 1024 ** index;
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function truncate(value, length = 80) {
    const text = String(value ?? '');
    if (text.length <= length) return text;
    return `${text.slice(0, Math.max(0, length - 1))}…`;
}

export function shortHash(value, length = 12) {
    const text = String(value ?? '');
    if (!text) return '—';
    return `${text.slice(0, length)}…`;
}

export function titleCase(value) {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function initials(value) {
    const text = String(value ?? '').trim();
    if (!text) return 'CV';
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const STATUS_TONES = {
    active: 'success',
    approved: 'success',
    verified: 'success',
    available: 'success',
    confirmed: 'success',
    healthy: 'success',
    completed: 'success',
    closed: 'neutral',
    archived: 'neutral',
    availableasset: 'success',
    good: 'success',
    operational: 'success',
    pending: 'warning',
    'in progress': 'brand',
    'under investigation': 'brand',
    'evidence collection': 'brand',
    'investigation review': 'brand',
    'legal review': 'info',
    'registered': 'info',
    'stored': 'info',
    'transferred': 'info',
    'assigned': 'info',
    'maintenance': 'warning',
    'todo': 'neutral',
    blocked: 'danger',
    rejected: 'danger',
    disabled: 'danger',
    suspended: 'danger',
    compromised: 'danger',
    failed: 'danger',
    critical: 'danger',
    high: 'danger',
    retired: 'neutral',
    disposed: 'neutral',
    cancelled: 'neutral',
    'in use': 'success',
    confidential: 'warning',
    restricted: 'danger',
    'highly restricted': 'danger',
    internal: 'info',
    public: 'neutral',
    low: 'neutral',
    medium: 'info',
    warning: 'warning',
    criticalalert: 'danger',
};

export function statusTone(value) {
    const key = String(value ?? '').trim().toLowerCase();
    if (!key) return 'neutral';
    return STATUS_TONES[key] || 'info';
}

export function severityTone(value) {
    const key = String(value ?? '').toLowerCase();
    if (key === 'critical' || key === 'danger' || key === 'error') return 'danger';
    if (key === 'warning' || key === 'warn') return 'warning';
    if (key === 'success' || key === 'ok' || key === 'valid') return 'success';
    return 'info';
}

export function countBy(items, selector) {
    return (items || []).reduce((result, item) => {
        const key = typeof selector === 'function' ? selector(item) : item?.[selector];
        const label = key && String(key).trim() ? String(key) : 'Unknown';
        result[label] = (result[label] || 0) + 1;
        return result;
    }, {});
}

export function toChartData(counts) {
    return Object.entries(counts || {})
        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
        .sort((left, right) => right.value - left.value);
}

export function groupByDay(values, getDate, days = 14) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = [];
    for (let index = days - 1; index >= 0; index -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - index);
        const key = day.toISOString().slice(0, 10);
        buckets.push({ date: day, key, label: day.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }), count: 0 });
    }
    const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    (values || []).forEach((value) => {
        const raw = getDate(value);
        if (!raw) return;
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return;
        const key = date.toISOString().slice(0, 10);
        const bucket = index.get(key);
        if (bucket) bucket.count += 1;
    });
    return buckets.map(({ label, count, key }) => ({ label, count, key }));
}

export function severityFromAction(action) {
    const text = String(action || '').toUpperCase();
    if (text.includes('COMPROMISED') || text.includes('FAILED') || text.includes('DENIED') || text.includes('VIOLATION') || text.includes('DELETED')) return 'warning';
    return 'info';
}
