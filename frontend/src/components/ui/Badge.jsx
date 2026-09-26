import clsx from 'clsx';
import { statusTone } from '../../lib/format.js';

const TONE_CLASSES = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-linkblue-500/30 bg-linkblue-500/10 text-linkblue-500',
    brand: 'border-brand-500/30 bg-brand-500/10 text-brand-500',
    neutral: 'border-ink-200 bg-ink-100 text-ink-700 dark:border-ink-600 dark:bg-ink-700/40 dark:text-ink-300',
};

export default function Badge({ tone, value, label, icon: Icon, className }) {
    const resolved = tone || statusTone(value);
    return (
        <span className={clsx('cv-badge border', TONE_CLASSES[resolved] || TONE_CLASSES.neutral, className)}>
            {Icon ? <Icon size={11} aria-hidden="true" /> : null}
            {label ?? value ?? '—'}
        </span>
    );
}

export function Dot({ tone = 'info', className }) {
    const colors = {
        success: 'bg-success',
        warning: 'bg-warning',
        danger: 'bg-danger',
        info: 'bg-linkblue-500',
        brand: 'bg-brand-500',
        neutral: 'bg-ink-400',
    };
    return <span className={clsx('inline-block h-2 w-2 rounded-full', colors[tone] || colors.info, className)} aria-hidden="true" />;
}
