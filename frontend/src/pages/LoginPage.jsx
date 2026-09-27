import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, Mail, ShieldCheck, Users } from 'lucide-react';
import AuthShell, { authAside } from '../components/layout/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Form.jsx';
import { InlineError } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { api, apiErrorCode, apiErrorMessage, unwrap } from '../lib/apiClient.js';

export default function LoginPage() {
    const { login, verifyMfa, fetchDemoCode } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [demoPending, setDemoPending] = useState(false);
    const [demoCode, setDemoCode] = useState('');
    const [demoAccounts, setDemoAccounts] = useState([]);
    const [demoPassword, setDemoPassword] = useState('password123');

    useDocumentTitle('Sign in');

    useEffect(() => {
        let active = true;
        api.get('/auth/demo-accounts', { skipAuth: true })
            .then(unwrap)
            .then((data) => {
                if (!active) return;
                setDemoAccounts(data?.accounts || []);
                if (data?.password) setDemoPassword(data.password);
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const destination = location.state?.from || '/dashboard';

    const onSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setPending(true);
        try {
            if (challenge) {
                try {
                    const result = await verifyMfa({ identifier, password, otp, challengeId: challenge.challengeId });
                    if (result?.requiresMfa) {
                        setChallenge({ challengeId: result.challengeId, expiresAt: result.expiresAt });
                        return;
                    }
                    navigate(destination, { replace: true });
                    return;
                } catch (caught) {
                    if (apiErrorCode(caught) !== 'INVALID_MFA_CHALLENGE') throw caught;
                    const refreshed = await login({ identifier: identifier.trim(), password });
                    setChallenge({ challengeId: refreshed.challengeId, expiresAt: refreshed.expiresAt });
                    setOtp('');
                    setDemoCode('');
                    setError('That MFA session expired. A new one has been started — get a fresh code below and enter it.');
                    return;
                }
            }
            const result = await login({ identifier: identifier.trim(), password });
            if (result?.requiresMfa) {
                setChallenge({ challengeId: result.challengeId, expiresAt: result.expiresAt });
                return;
            }
            navigate(destination, { replace: true });
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Sign in failed. Verify your credentials and try again.'));
        } finally {
            setPending(false);
        }
    };

    const onDemoCode = async () => {
        setError('');
        setDemoPending(true);
        try {
            const result = await fetchDemoCode({ identifier: identifier.trim(), password });
            setDemoCode(result?.code ? `Development MFA code: ${result.code}` : 'A development MFA code is not available for this account.');
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to obtain a development MFA code.'));
        } finally {
            setDemoPending(false);
        }
    };

    return (
        <AuthShell
            title={challenge ? 'Two-factor verification' : 'Sign in to CaseVault'}
            subtitle={challenge ? 'Enter the 6-digit code from your authenticator app to continue.' : 'Use your CaseVault email address or username.'}
            aside={authAside}
            footer={(
                <div className="flex flex-col gap-1">
                    <p>
                        Need an account?{' '}
                        <Link to="/register" className="cv-link">Create one</Link>
                    </p>
                    <p>
                        <Link to="/forgot-password" className="cv-link">Forgot your password?</Link>
                    </p>
                </div>
            )}
        >
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
                {!challenge ? (
                    <>
                        <Input
                            label="Email or username"
                            type="text"
                            autoComplete="username"
                            required
                            value={identifier}
                            onChange={(event) => setIdentifier(event.target.value)}
                            placeholder="investigator@casevault.local"
                        />
                        <Input
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="••••••••"
                        />
                    </>
                ) : (
                    <>
                        <Input
                            label="Authentication code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                            maxLength={10}
                            value={otp}
                            onChange={(event) => setOtp(event.target.value.replace(/\s/g, ''))}
                            placeholder="000000"
                        />
                        <Button variant="secondary" size="sm" icon={KeyRound} loading={demoPending} onClick={onDemoCode} type="button">
                            Get development MFA code
                        </Button>
                        {demoCode ? <p className="text-xs font-semibold text-linkblue-500">{demoCode}</p> : null}
                        {demoCode ? (
                            <p className="text-xs text-ink-500 dark:text-ink-400">
                                Codes rotate every 30 seconds. If verification is rejected, request a new code and submit it straight away.
                            </p>
                        ) : null}
                        <button
                            type="button"
                            className="cv-link text-xs"
                            onClick={() => {
                                setChallenge(null);
                                setOtp('');
                                setDemoCode('');
                            }}
                        >
                            Use a different account
                        </button>
                    </>
                )}

                <InlineError message={error} />

                <Button type="submit" icon={challenge ? ShieldCheck : LogIn} loading={pending} className="w-full">
                    {challenge ? 'Verify and sign in' : 'Sign in'}
                </Button>
            </form>

            {demoAccounts.length ? (
                <div className="mt-4 rounded-lg border cv-divider bg-ink-50 px-3 py-3 dark:bg-ink-800/60">
                    <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-ink-700 dark:text-ink-200">
                        <Users size={12} aria-hidden="true" />
                        Demo accounts for prototype testing
                    </p>
                    <p className="mt-1 text-[0.7rem] text-ink-500 dark:text-ink-400">
                        Password for every account: <code className="font-semibold text-ink-700 dark:text-ink-200">{demoPassword}</code>. Click a row to fill the form.
                    </p>
                    <ul className="mt-2 space-y-1">
                        {demoAccounts.map((account) => (
                            <li key={account.email}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIdentifier(account.email);
                                        setPassword(demoPassword);
                                        setOtp('');
                                        setError('');
                                        setChallenge(null);
                                    }}
                                    className="flex w-full items-center justify-between gap-2 rounded-md border cv-divider bg-white/70 px-2.5 py-1.5 text-left transition hover:border-linkblue-500/60 hover:bg-white dark:bg-ink-900/60 dark:hover:bg-ink-900"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-[0.72rem] font-semibold text-ink-800 dark:text-ink-100">{account.role}</span>
                                        <span className="block truncate text-[0.65rem] text-ink-500 dark:text-ink-400">{account.email}</span>
                                    </span>
                                    <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                                        {account.mfaEnabled ? 'MFA' : 'Direct'}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-[0.65rem] text-ink-500 dark:text-ink-400">
                        Accounts marked MFA need a one-time code — use “Get development MFA code” on the verification step.
                    </p>
                </div>
            ) : null}

            <div className="mt-6 rounded-lg border cv-divider bg-ink-50 px-3 py-3 text-[0.7rem] text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <p className="flex items-center gap-1.5 font-bold text-ink-700 dark:text-ink-200">
                    <Mail size={12} aria-hidden="true" />
                    Development accounts
                </p>
                <p className="mt-1">Seeded operators include admin, supervisor, investigator, legal, analyst and forensics, all using the deployment development password.</p>
            </div>
        </AuthShell>
    );
}
