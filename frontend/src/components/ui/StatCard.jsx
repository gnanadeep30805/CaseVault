import clsx from 'clsx';

const TONES = {
    brand: 'bg-brand-500/10 text-brand-500',
    blue: 'bg-linkblue-500/10 text-linkblue-500',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-700/50 dark:text-ink-300',
};

export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand', loading = false, onClick }) {
    const Element = onClick ? 'button' : 'div';
    return (
        <Element
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={clsx('cv-panel flex w-full items-start gap-3 p-4 text-left shadow-panel', onClick && 'transition hover:border-brand-500/50')}
        >
            {Icon ? (
                <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone] || TONES.brand)}>
                    <Icon size={18} aria-hidden="true" />
                </span>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{label}</p>
                {loading ? (
                    <div className="cv-skeleton mt-2 h-7 w-16" aria-hidden="true" />
                ) : (
                    <p className="mt-1 text-2xl font-bold leading-none text-ink-900 dark:text-ink-50">{value ?? '—'}</p>
                )}
                {hint ? <p className="mt-1.5 truncate text-[0.7rem] text-ink-500 dark:text-ink-400">{hint}</p> : null}
            </div>
        </Element>
    );
}
