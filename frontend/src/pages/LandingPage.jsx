import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Building2,
    FileText,
    Fingerprint,
    Gavel,
    LayoutDashboard,
    Lock,
    ScrollText,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { Moon, Sun } from 'lucide-react';

const CAPABILITIES = [
    { icon: LayoutDashboard, title: 'Role-aware operations', text: 'Dashboards, case queues and task boards adapt to role, department and clearance so each operator sees only the work they are authorized for.' },
    { icon: FileText, title: 'Encrypted document vault', text: 'Upload PDF, image, spreadsheet and text evidence. Every file is encrypted at rest, versioned, classified and hash-registered on arrival.' },
    { icon: Fingerprint, title: 'Chain of custody', text: 'Evidence transfers are recorded as hash-linked events, so custody gaps or tampering are immediately detectable.' },
    { icon: Gavel, title: 'Legal workflow', text: 'Structured case lifecycle from intake through legal review to closure, with supervisor approvals and signature requests built in.' },
    { icon: ScrollText, title: 'Tamper-evident audit', text: 'Every state change is written to a hash-chained audit log that can be verified and exported for evidentiary review.' },
    { icon: Sparkles, title: 'Source-bound AI analysis', text: 'Ask questions about a case and receive deterministic analysis restricted to the sources you are already authorized to read.' },
];

const CONTROL_POINTS = [
    { label: 'Authentication', value: 'JWT access tokens with refresh rotation and optional TOTP multi-factor enforcement' },
    { label: 'Authorization', value: 'Server-side policy evaluation on every case, document, evidence and task request' },
    { label: 'Integrity', value: 'SHA-256 content hashing with Ed25519 signatures on documents and evidence records' },
    { label: 'Storage', value: 'AES-256-GCM encryption at rest with per-document nonces and authenticated tags' },
    { label: 'Audit', value: 'Hash-chained audit events with CSV export and on-demand chain verification' },
    { label: 'Access control', value: 'Department scoping, document sharing with expiry, and clearance-limited disclosure' },
];

export default function LandingPage() {
    const { isAuthenticated } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    useDocumentTitle('Secure case management for law enforcement and legal teams');

    return (
        <div className="min-h-screen bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-100">
            <a href="#landing-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
                Skip to main content
            </a>

            <header className="sticky top-0 z-20 border-b cv-divider bg-white/90 backdrop-blur dark:bg-ink-800/90">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                            <ShieldCheck size={18} aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold tracking-wide">CaseVault</span>
                            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">Secure case management</span>
                        </span>
                    </div>
                    <nav className="flex items-center gap-2" aria-label="Account">
                        <a href="#capabilities" className="hidden text-sm font-semibold text-ink-600 hover:text-ink-900 sm:block dark:text-ink-300 dark:hover:text-white">Capabilities</a>
                        <a href="#controls" className="hidden text-sm font-semibold text-ink-600 hover:text-ink-900 sm:block dark:text-ink-300 dark:hover:text-white">Controls</a>
                        <button type="button" onClick={toggleTheme} className="cv-btn-ghost rounded-lg p-2" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
                            {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                        </button>
                        {isAuthenticated ? (
                            <Link to="/dashboard" className="cv-btn cv-btn-primary">
                                Open workspace
                                <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="cv-btn cv-btn-secondary">Sign in</Link>
                                <Link to="/register" className="cv-btn cv-btn-primary">Request access</Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            <main id="landing-main">
                <section className="border-b cv-divider bg-white dark:bg-ink-800">
                    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-20">
                        <div>
                            <p className="cv-badge border border-brand-500/30 bg-brand-500/10 text-brand-500">Chain of custody · Hash integrity · Full auditability</p>
                            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                                Case management built around evidence, authorization and defensible records.
                            </h1>
                            <p className="mt-4 max-w-2xl text-base text-ink-600 dark:text-ink-300">
                                CaseVault gives investigators, legal officers and supervisors a single workspace for casework, encrypted documents, chain-of-custody evidence and task coordination — with integrity verification and audit logging applied by the server, not the interface.
                            </p>
                            <div className="mt-7 flex flex-wrap gap-3">
                                {isAuthenticated ? (
                                    <Link to="/dashboard" className="cv-btn cv-btn-primary">
                                        Open workspace
                                        <ArrowRight size={15} aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/register" className="cv-btn cv-btn-primary">
                                            Create an account
                                            <ArrowRight size={15} aria-hidden="true" />
                                        </Link>
                                        <Link to="/login" className="cv-btn cv-btn-secondary">Sign in</Link>
                                    </>
                                )}
                            </div>
                            <p className="mt-5 text-xs text-ink-500 dark:text-ink-400">
                                CaseVault is a reference implementation. All seeded records, identities and documents are fictional.
                            </p>
                        </div>

                        <div className="cv-panel p-5 shadow-panel">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Control summary</h2>
                            <ul className="mt-3 space-y-3">
                                {CONTROL_POINTS.map((point) => (
                                    <li key={point.label} className="flex gap-3">
                                        <Lock size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                                        <div>
                                            <p className="text-sm font-bold">{point.label}</p>
                                            <p className="text-xs text-ink-600 dark:text-ink-300">{point.value}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section id="capabilities" className="mx-auto max-w-6xl px-4 py-16">
                    <h2 className="text-2xl font-bold tracking-tight">Everything a case requires, in one workspace</h2>
                    <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
                        Each module is backed by enforced API contracts, so what an operator sees is exactly what the platform is willing to disclose.
                    </p>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {CAPABILITIES.map((item) => (
                            <article key={item.title} className="cv-panel p-5 shadow-panel">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                                    <item.icon size={18} aria-hidden="true" />
                                </span>
                                <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                                <p className="mt-1.5 text-xs leading-relaxed text-ink-600 dark:text-ink-300">{item.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="controls" className="border-y cv-divider bg-white dark:bg-ink-800">
                    <div className="mx-auto max-w-6xl px-4 py-16">
                        <h2 className="text-2xl font-bold tracking-tight">Security is enforced server-side</h2>
                        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
                            Hiding a control in the interface is not a security boundary. CaseVault evaluates authorization, integrity and audit rules inside the API for every request.
                        </p>
                        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {CONTROL_POINTS.map((point) => (
                                <div key={point.label} className="cv-panel-alt p-4">
                                    <dt className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{point.label}</dt>
                                    <dd className="mt-1.5 text-xs text-ink-700 dark:text-ink-200">{point.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl px-4 py-16">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="cv-panel p-5 shadow-panel">
                            <Building2 size={18} className="text-brand-500" aria-hidden="true" />
                            <h2 className="mt-3 text-sm font-bold">Built for departments</h2>
                            <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-300">
                                Case ownership, department scoping and clearance levels keep investigations compartmentalised while oversight roles retain cross-department visibility where policy allows.
                            </p>
                        </div>
                        <div className="cv-panel p-5 shadow-panel">
                            <FileText size={18} className="text-brand-500" aria-hidden="true" />
                            <h2 className="mt-3 text-sm font-bold">Defensible document handling</h2>
                            <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-300">
                                Version history, approvals, signature requests, controlled sharing with revocation, and one-click integrity verification for every stored file.
                            </p>
                        </div>
                        <div className="cv-panel p-5 shadow-panel">
                            <ShieldCheck size={18} className="text-brand-500" aria-hidden="true" />
                            <h2 className="mt-3 text-sm font-bold">Evidentiary reporting</h2>
                            <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-300">
                                Export case, document, evidence, task and integrity reports as CSV, and verify the audit and custody hash chains before handing material to a court.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="border-t cv-divider bg-ink-900 text-white">
                    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Ready to review a case?</h2>
                            <p className="mt-1 text-sm text-ink-300">Sign in with your CaseVault operator account or request access for your department.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/login" className="cv-btn cv-btn-primary">Sign in</Link>
                            <Link to="/register" className="cv-btn cv-btn-secondary">Request access</Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t cv-divider bg-white px-4 py-8 dark:bg-ink-800">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-ink-500 dark:text-ink-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} CaseVault · Reference secure case management platform.</p>
                    <p>Fictional demonstration data · Not a legal conclusion</p>
                </div>
            </footer>
        </div>
    );
}
