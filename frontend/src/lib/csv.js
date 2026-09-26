function escapeCell(value) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
}

export function rowsToCsv(rows, columns) {
    const list = Array.isArray(rows) ? rows : [];
    const keys = columns?.length
        ? columns
        : [...new Set(list.flatMap((row) => Object.keys(row || {})))];
    const header = keys.map((key) => escapeCell(key)).join(',');
    const body = list
        .map((row) => keys.map((key) => {
            const value = typeof key === 'function' ? key(row) : row?.[key];
            return escapeCell(value);
        }).join(','))
        .join('\n');
    return `${header}\n${body}`;
}

export function downloadCsv(filename, rows, columns) {
    const csv = rowsToCsv(rows, columns);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function timestampedName(prefix, extension = 'csv') {
    const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
    return `${prefix}-${stamp}.${extension}`;
}
