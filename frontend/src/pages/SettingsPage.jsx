import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Palette, ShieldCheck, Sun } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader, KeyValue, SectionTitle } from '../components/ui/Card.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { baseURL } from '../lib/apiClient.js';

const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage() {
    const { user } = useAuth();
    const { preference, resolved, setTheme } = useTheme();
    useDocumentTitle('Settings');
    const [stored, setStored] = useState('session');

    useEffect(() => {
        try {
            setStored(window.sessionStorage.getItem('casevault.accessToken') ? 'session' : 'none');
        } catch {
            setStored('unavailable');
        }
    }, []);

    return (
        <div className="space-y-5">
            <PageHeader title="Settings" description="Appearance and session information for this browser. Security policy is enforced server-side and cannot be relaxed here." />

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Appearance" icon={Palette} description="Applied immediately and remembered on this device." />
                    <CardBody className="space-y-3">
                        <div role="radiogroup" aria-label="Colour theme" className="grid gap-2 sm:grid-cols-3">
                            {THEME_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const active = preference === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setTheme(option.value)}
                                        className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                                            active
                                                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                                                : 'cv-divider text-ink-600 hover:border-ink-300 dark:text-ink-300'
                                        }`}
                                    >
                                        <Icon size={18} aria-hidden="true" />
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-ink-500 dark:text-ink-400">
                            Currently rendering the <span className="font-semibold">{resolved}</span> theme.
                        </p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Session" icon={ShieldCheck} description="Tokens are held in session storage so they are discarded when the tab closes." />
                    <CardBody>
                        <KeyValue
                            columns={2}
                            items={[
                                { label: 'Token storage', value: <Badge value={stored === 'session' ? 'Session storage' : stored} tone={stored === 'session' ? 'success' : 'warning'} /> },
                                { label: 'Access token lifetime', value: '15 minutes' },
                                { label: 'Refresh rotation', value: 'Enabled' },
                                { label: 'API base URL', value: <span className="font-mono text-xs">{baseURL}</span> },
                            ]}
                        />
                        <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
                            Signing out revokes the refresh token server-side, so a copied token cannot be reused.
                        </p>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader title="Enforced policy" icon={ShieldCheck} description="These controls are defined on the server and apply to every session." />
                <CardBody className="space-y-3">
                    <KeyValue
                        columns={2}
                        items={[
                            { label: 'Your role', value: user?.role },
                            { label: 'Your clearance', value: user?.clearance },
                            { label: 'Multi-factor', value: <Badge value={user?.mfaEnabled ? 'Required' : 'Not enforced'} tone={user?.mfaEnabled ? 'success' : 'warning'} /> },
                            { label: 'Document storage', value: 'AES-256-GCM at rest' },
                            { label: 'Hashing', value: 'SHA-256' },
                            { label: 'Signatures', value: 'Ed25519' },
                        ]}
                    />
                    <div>
                        <SectionTitle>What you cannot change here</SectionTitle>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink-600 dark:text-ink-300">
                            <li>Your role, department or clearance — only an Administrator can change these.</li>
                            <li>Document retention, classification or approval rules.</li>
                            <li>Audit and chain-of-custody records, which are append-only by design.</li>
                        </ul>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <Check size={12} className="text-success" aria-hidden="true" />
                        Settings are stored per browser and are not written to the audit trail.
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
