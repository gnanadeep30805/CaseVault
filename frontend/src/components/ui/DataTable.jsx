import clsx from 'clsx';
import { EmptyState } from './States.jsx';

export default function DataTable({ columns, rows, getRowKey, emptyTitle = 'No records found', emptyDescription, emptyIcon, mobileTitle, onRowClick, dense = false }) {
    const items = Array.isArray(rows) ? rows : [];
    const keyOf = getRowKey || ((row, index) => row?.id || index);
    const primaryKey = columns.find((column) => column.primary)?.key || columns[0]?.key;

    if (items.length === 0) {
        return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
    }

    return (
        <div>
            <div className="hidden overflow-x-auto md:block cv-scroll">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b cv-divider">
                            {columns.map((column) => (
                                <th key={column.key} scope="col" className={clsx('whitespace-nowrap px-3 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400', column.className)}>
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((row, index) => (
                            <tr
                                key={keyOf(row, index)}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                className={clsx('border-b cv-divider last:border-0', onRowClick && 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-700/30')}
                            >
                                {columns.map((column) => (
                                    <td key={column.key} className={clsx('px-3 align-middle text-ink-700 dark:text-ink-200', dense ? 'py-2' : 'py-3', column.cellClassName)}>
                                        {column.render ? column.render(row, index) : (row?.[column.key] ?? '—')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="space-y-3 md:hidden">
                {items.map((row, index) => {
                    const primary = primaryKey ? row?.[primaryKey] : null;
                    return (
                        <li key={keyOf(row, index)} className="cv-panel-alt p-3">
                            {mobileTitle ? <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{mobileTitle}</p> : null}
                            <p className="text-sm font-bold text-ink-900 dark:text-ink-50">{primary ? String(primary) : '—'}</p>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                                {columns.filter((column) => column.key !== primaryKey).map((column) => (
                                    <div key={column.key} className="min-w-0">
                                        <dt className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{column.header}</dt>
                                        <dd className="mt-0.5 break-words text-xs font-medium text-ink-800 dark:text-ink-100">{column.mobile !== false && column.render ? column.render(row, index) : (row?.[column.key] ?? '—')}</dd>
                                    </div>
                                ))}
                            </dl>
                            {onRowClick ? (
                                <button type="button" className="cv-btn-secondary cv-btn-sm mt-3 w-full" onClick={() => onRowClick(row)}>
                                    View details
                                </button>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
