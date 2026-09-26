import clsx from 'clsx';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';

export const CHART_COLORS = ['#4F46E5', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0F172A', '#475569', '#94A3B8'];

const axisProps = {
    stroke: 'var(--cv-border)',
    tick: { fill: 'var(--cv-muted)', fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: 'var(--cv-border)' },
};

function ChartTooltip({ active, payload, label, unit = '' }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="cv-panel px-3 py-2 text-xs shadow-panel">
            {label ? <p className="font-bold text-ink-900 dark:text-ink-50">{label}</p> : null}
            <ul className="mt-1 space-y-0.5">
                {payload.map((entry) => (
                    <li key={entry.dataKey || entry.name} className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
                        <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.fill }} aria-hidden="true" />
                        {entry.name}: <span className="font-bold">{entry.value}{unit}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function BarList({ data = [], emptyLabel = 'No data available.', valueLabel = 'records' }) {
    const rows = (data || []).filter((item) => Number(item.value) >= 0);
    if (!rows.length) return <p className="py-6 text-center text-xs text-ink-500 dark:text-ink-400">{emptyLabel}</p>;
    const max = Math.max(...rows.map((item) => Number(item.value) || 0), 1);
    return (
        <ul className="space-y-2">
            {rows.map((item, index) => {
                const value = Number(item.value) || 0;
                const percent = Math.round((value / max) * 100);
                return (
                    <li key={item.name}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-semibold text-ink-700 dark:text-ink-200">{item.name}</span>
                            <span className="shrink-0 text-ink-500 dark:text-ink-400">{value} {valueLabel}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700/50" role="presentation">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(percent, value > 0 ? 4 : 0)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export function ChartCard({ title, description, children, className, action, height = 260 }) {
    return (
        <section className={clsx('cv-panel flex flex-col shadow-panel', className)}>
            <header className="flex items-start justify-between gap-3 border-b cv-divider px-4 py-3">
                <div>
                    <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">{title}</h2>
                    {description ? <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
                </div>
                {action}
            </header>
            <div className="flex-1 px-2 py-3" style={{ minHeight: height }}>
                {children}
            </div>
        </section>
    );
}

export function CaseStatusChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cv-border)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-18} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--cv-panel-alt)' }} />
                <Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]} fill="#4F46E5">
                    {data.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export function DocumentTypeChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={230}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2} stroke="var(--cv-panel)">
                    {data.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: 'var(--cv-muted)' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

export function ActivityChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                <defs>
                    <linearGradient id="cvActivityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cv-border)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Events" stroke="#4F46E5" strokeWidth={2} fill="url(#cvActivityFill)" />
            </AreaChart>
        </ResponsiveContainer>
    );
}

export function CaseWorkloadChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cv-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="name" width={104} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--cv-panel-alt)' }} />
                <Bar dataKey="value" name="Cases" radius={[0, 4, 4, 0]} fill="#2563EB" />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function StatusBarChart({ data, name = 'Records', color = '#16A34A' }) {
    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cv-border)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-18} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--cv-panel-alt)' }} />
                <Bar dataKey="value" name={name} radius={[4, 4, 0, 0]} fill={color} />
            </BarChart>
        </ResponsiveContainer>
    );
}
