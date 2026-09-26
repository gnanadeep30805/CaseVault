export default function PageHeader({ title, description, actions, breadcrumb, children }) {
    return (
        <header className="mb-5 flex flex-col gap-3">
            {breadcrumb ? <div className="text-xs font-medium text-ink-500 dark:text-ink-400">{breadcrumb}</div> : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-2xl">{title}</h1>
                    {description ? <p className="mt-1 max-w-3xl text-sm text-ink-500 dark:text-ink-400">{description}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {children}
        </header>
    );
}
