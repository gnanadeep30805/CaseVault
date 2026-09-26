import clsx from 'clsx';

export function Card({ as: Element = 'section', className, children, ...rest }) {
    return (
        <Element className={clsx('cv-panel shadow-panel', className)} {...rest}>
            {children}
        </Element>
    );
}

export function CardHeader({ title, description, actions, icon: Icon, id }) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b cv-divider px-4 py-3 sm:px-5">
            <div className="min-w-0">
                <h2 id={id} className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink-900 dark:text-ink-50">
                    {Icon ? <Icon size={16} className="text-brand-500" aria-hidden="true" /> : null}
                    {title}
                </h2>
                {description ? <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
    );
}

export function CardBody({ className, children, ...rest }) {
    return <div className={clsx('px-4 py-4 sm:px-5', className)} {...rest}>{children}</div>;
}

export function SectionTitle({ children, className }) {
    return <h3 className={clsx('text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400', className)}>{children}</h3>;
}

const COLUMN_CLASSES = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
};

export function KeyValue({ items, columns = 2 }) {
    return (
        <dl className={clsx('grid gap-3', COLUMN_CLASSES[columns] || COLUMN_CLASSES[2])}>
            {items.filter(Boolean).map((item) => (
                <div key={item.label} className="min-w-0">
                    <dt className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{item.label}</dt>
                    <dd className="mt-0.5 break-words text-sm font-medium text-ink-800 dark:text-ink-100">{item.value ?? '—'}</dd>
                </div>
            ))}
        </dl>
    );
}
