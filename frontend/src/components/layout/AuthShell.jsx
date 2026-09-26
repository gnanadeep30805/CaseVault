import { Link } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';

export default function AuthShell({ title, subtitle, children, footer, aside }) {
    return (
        <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
            <header className="border-b cv-divider bg-white dark:bg-ink-800">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
                    <Link to="/" className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                            <ShieldCheck size={18} aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold tracking-wide text-ink-900 dark:text-ink-50">CaseVault</span>
                            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">Secure Case Management</span>
                        </span>
                    </Link>
                    <Link to="/" className="text-sm font-semibold text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white">
                        Back to site
                    </Link>
                </div>
            </header>

            <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-16">
                <div className="cv-panel w-full max-w-md self-start px-5 py-6 shadow-panel sm:px-7">
                    <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">{title}</h1>
                    {subtitle ? <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p> : null}
                    <div className="mt-6">{children}</div>
                    {footer ? <div className="mt-6 border-t cv-divider pt-4 text-sm text-ink-600 dark:text-ink-300">{footer}</div> : null}
                </div>
                <aside className="hidden lg:block">{aside}</aside>
            </main>

            <footer className="border-t cv-divider px-4 py-6 text-center text-[0.7rem] text-ink-500 dark:text-ink-400">
                <p className="inline-flex items-center gap-1.5">
                    <Lock size={12} aria-hidden="true" />
                    CaseVault enforces authorization, integrity verification and audit controls server-side.
                </p>
            </footer>
        </div>
    );
}

export const authAside = (
    <div className="cv-panel h-full px-6 py-6 shadow-panel">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Platform controls</h2>
        <ul className="mt-4 space-y-4 text-sm text-ink-600 dark:text-ink-300">
            <li>
                <p className="font-bold text-ink-900 dark:text-ink-50">Server-side authorization</p>
                <p className="mt-1 text-xs">Every case, document and evidence request is authorized by the API against role, department and clearance.</p>
            </li>
            <li>
                <p className="font-bold text-ink-900 dark:text-ink-50">Cryptographic integrity</p>
                <p className="mt-1 text-xs">Documents are encrypted at rest, hashed with SHA-256 and signed with Ed25519 so tampering is detectable.</p>
            </li>
            <li>
                <p className="font-bold text-ink-900 dark:text-ink-50">Tamper-evident audit trail</p>
                <p className="mt-1 text-xs">Audit events and chain-of-custody transfers form hash chains that can be verified on demand.</p>
            </li>
            <li>
                <p className="font-bold text-ink-900 dark:text-ink-50">Multi-factor authentication</p>
                <p className="mt-1 text-xs">TOTP challenges are required for accounts with MFA enabled, with short-lived access tokens.</p>
            </li>
        </ul>
    </div>
);
