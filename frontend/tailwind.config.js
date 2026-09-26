/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                ink: {
                    950: '#080F1F',
                    900: '#0F172A',
                    800: '#1E293B',
                    700: '#334155',
                    600: '#475569',
                    500: '#64748B',
                    400: '#94A3B8',
                    300: '#CBD5E1',
                    200: '#E2E8F0',
                    100: '#F1F5F9',
                    50: '#F8FAFC',
                },
                brand: {
                    50: '#EEF2FF',
                    100: '#E0E7FF',
                    200: '#C7D2FE',
                    500: '#4F46E5',
                    600: '#4338CA',
                    700: '#3730A3',
                },
                linkblue: {
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    500: '#2563EB',
                    600: '#1D4ED8',
                },
                success: '#16A34A',
                warning: '#D97706',
                danger: '#DC2626',
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
            },
            boxShadow: {
                panel: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.05)',
                overlay: '0 24px 60px rgba(15, 23, 42, 0.28)',
            },
        },
    },
    plugins: [],
};
