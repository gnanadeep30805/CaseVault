import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'casevault.theme';

function readStored() {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
        return 'system';
    }
    return 'system';
}

function systemPrefersDark() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
    const [preference, setPreference] = useState(readStored);
    const [systemDark, setSystemDark] = useState(systemPrefersDark);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined;
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (event) => setSystemDark(event.matches);
        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
    }, []);

    const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', resolved === 'dark');
        root.style.colorScheme = resolved;
    }, [resolved]);

    const setTheme = useCallback((next) => {
        const value = ['light', 'dark', 'system'].includes(next) ? next : 'system';
        setPreference(value);
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            return value;
        }
        return value;
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(resolved === 'dark' ? 'light' : 'dark');
    }, [resolved, setTheme]);

    const value = useMemo(() => ({ preference, resolved, isDark: resolved === 'dark', setTheme, toggleTheme }), [preference, resolved, setTheme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used inside ThemeProvider');
    return context;
}
