import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import AuthShell, { authAside } from '../components/layout/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Form.jsx';
import { InlineError, InlineSuccess } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { api, apiErrorMessage } from '../lib/apiClient.js';

const PASSWORD_HINT = 'At least 10 characters with upper case, lower case and a digit.';

export default function ForgotPasswordPage() {
    const { requestPasswordReset } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState('');
    const [stage, setStage] = useState('request');
    const [pending, setPending] = useState(false);

    useDocumentTitle('Reset password');

    const request = async (event) => {
        event.preventDefault();
        setError('');
        setResult('');
        setPending(true);
        try {
            const response = await requestPasswordReset({ email: email.trim() });
            setResult(response?.message || 'If the account exists and is active, a reset token has been issued to its registered channels.');
            if (response?.demoToken) {
                setToken(response.demoToken);
                setStage('reset');
            } else {
                setStage('pending');
            }
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to process the reset request.'));
        } finally {
            setPending(false);
        }
    };

    const reset = async (event) => {
        event.preventDefault();
        setError('');
        if (password !== confirm) {
            setError('The two passwords do not match.');
            return;
        }
        setPending(true);
        try {
            const response = await api.post('/auth/reset-password', { token: token.trim(), password }, { skipAuth: true });
            toast.success(response?.data?.data?.message || 'Your password has been reset. Sign in with the new password.');
            navigate('/login', { replace: true });
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The password could not be reset.'));
        } finally {
            setPending(false);
        }
    };

    if (stage === 'reset') {
        return (
            <AuthShell
                title="Choose a new password"
                subtitle="This development deployment returns the reset token directly so the flow can be completed without an external mail server."
                aside={authAside}
                footer={<p><Link to="/login" className="cv-link">Back to sign in</Link></p>}
            >
                <form onSubmit={reset} className="space-y-4" noValidate>
                    <Input label="Reset token" required value={token} onChange={(event) => setToken(event.target.value)} />
                    <Input label="New password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} hint={PASSWORD_HINT} />
                    <Input label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                    <InlineError message={error} />
                    <Button type="submit" icon={ShieldCheck} loading={pending} className="w-full">Reset password</Button>
                    <p className="text-xs text-ink-500 dark:text-ink-400">Resetting revokes every active refresh session for the account.</p>
                </form>
            </AuthShell>
        );
    }
    if (stage === 'pending') {
        return (
            <AuthShell
                title="Check your registered channels"
                subtitle="If the account exists and is active, a reset token has been issued."
                aside={authAside}
                footer={<p><Link to="/login" className="cv-link">Back to sign in</Link></p>}
            >
                <div className="space-y-4">
                    <InlineSuccess message={result} />
                    <p className="text-sm text-ink-600 dark:text-ink-300">
                        This deployment has no external mail transport, so the token was not delivered to your inbox. Paste the token
                        you received to finish the reset, or ask a CaseVault administrator to reset your credentials.
                    </p>
                    <Input
                        label="Reset token"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="Paste the token from your reset message"
                    />
                    <InlineError message={error} />
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setStage('reset')}
                        disabled={!token.trim()}
                        className="w-full"
                    >
                        Continue with this token
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setStage('request'); setResult(''); setError(''); setToken(''); }} className="w-full">
                        Use a different email
                    </Button>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Reset your password"
            subtitle="Submit your work email address and CaseVault will issue reset instructions to registered accounts."
            aside={authAside}
            footer={(
                <p>
                    Remembered your password?{' '}
                    <Link to="/login" className="cv-link">Back to sign in</Link>
                </p>
            )}
        >
            <form onSubmit={request} className="space-y-4" noValidate>
                <Input
                    label="Work email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@agency.gov"
                />
                {result ? <InlineSuccess message={result} /> : null}
                <InlineError message={error} />
                <Button type="submit" icon={KeyRound} loading={pending} className="w-full">
                    Request password reset
                </Button>
            </form>
            <p className="mt-4 flex items-start gap-1.5 text-[0.7rem] text-ink-500 dark:text-ink-400">
                <Mail size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                For your protection, reset instructions are only issued to accounts that already exist in CaseVault.
            </p>
        </AuthShell>
    );
}
