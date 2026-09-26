import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import AuthShell, { authAside } from '../components/layout/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Form.jsx';
import { InlineError } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { apiErrorMessage } from '../lib/apiClient.js';

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

    useDocumentTitle('Sign in');

    const destination = location.state?.from || '/dashboard';

    const onSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setPending(true);
        try {
            const result = challenge
                ? await verifyMfa({ identifier, password, otp, challengeId: challenge.challengeId })
                : await login({ identifier: identifier.trim(), password });
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
