import clsx from 'clsx';

export function Skeleton({ className }) {
    return <div className={clsx('cv-skeleton', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }) {
    return (
        <div className={clsx('space-y-2', className)} aria-hidden="true">
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton key={index} className={clsx('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
            ))}
        </div>
    );
}

export function SkeletonStats({ count = 4 }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="cv-panel p-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-3 h-7 w-16" />
                    <Skeleton className="mt-3 h-2.5 w-32" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
    return (
        <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="grid gap-3 sm:grid-cols-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: columns }).map((__, cellIndex) => (
                        <Skeleton key={cellIndex} className="h-4 w-full" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonChart({ className }) {
    return (
        <div className={clsx('space-y-3', className)} aria-hidden="true">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-44 w-full" />
        </div>
    );
}

export function LoadingBlock({ label = 'Loading…', className }) {
    return (
        <div className={clsx('flex items-center gap-2 py-6 text-sm text-ink-500 dark:text-ink-400', className)} role="status">
            <span className="h-3 w-3 animate-ping rounded-full bg-brand-500" aria-hidden="true" />
            {label}
        </div>
    );
}
