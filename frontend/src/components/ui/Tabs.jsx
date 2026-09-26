import clsx from 'clsx';

export default function Tabs({ tabs, active, onChange, ariaLabel = 'Sections' }) {
    return (
        <div className="mb-4 overflow-x-auto border-b cv-divider cv-scroll" role="tablist" aria-label={ariaLabel}>
            <div className="flex min-w-max gap-1">
                {tabs.filter(Boolean).map((tab) => {
                    const isActive = tab.id === active;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`tab-${tab.id}`}
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            onClick={() => onChange(tab.id)}
                            className={clsx(
                                '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition',
                                isActive
                                    ? 'border-brand-500 text-brand-500'
                                    : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100',
                            )}
                        >
                            {tab.icon ? <tab.icon size={15} aria-hidden="true" /> : null}
                            {tab.label}
                            {typeof tab.count === 'number' ? (
                                <span className="ml-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-ink-600 dark:bg-ink-700 dark:text-ink-200">{tab.count}</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function TabPanel({ id, active, children }) {
    if (id !== active) return null;
    return (
        <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1} className="focus:outline-none">
            {children}
        </div>
    );
}
