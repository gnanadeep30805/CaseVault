import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, UserPlus } from 'lucide-react';
import AuthShell, { authAside } from '../components/layout/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/Form.jsx';
import { InlineError, InlineSuccess } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { apiErrorMessage } from '../lib/apiClient.js';

const SELF_ASSIGNABLE_ROLES = ['Investigation Officer', 'Analyst', 'Viewer'];

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [form, setForm] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        department: 'Operations',
        role: 'Investigation Officer',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pending, setPending] = useState(false);
    const [mfaSetup, setMfaSetup] = useState(null);

    useDocumentTitle('Create account');

    const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

    const onSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        if (form.password !== form.confirmPassword) {
            setError('The passwords do not match.');
            return;
        }
        setPending(true);
        try {
            const result = await register({
                name: form.name.trim(),
                email: form.email.trim(),
                username: form.username.trim(),
                password: form.password,
                department: form.department.trim() || 'Operations',
                role: form.role,
            });
            setMfaSetup(result?.mfaSetup || null);
            setSuccess(`Account created for ${result?.user?.email || form.email}. Sign in to continue.`);
            toast.success('Account created successfully.');
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Registration failed.'));
        } finally {
            setPending(false);
        }
    };

    return (
        <AuthShell
            title="Create your CaseVault account"
            subtitle="New accounts receive investigation-level access with multi-factor authentication enabled."
            aside={authAside}
            footer={(
                <p>
                    Already registered?{' '}
                    <Link to="/login" className="cv-link">Sign in</Link>
                </p>
            )}
        >
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <Input label="Full name" required value={form.name} onChange={update('name')} autoComplete="name" placeholder="Jordan Ellis" />
                <Input label="Work email" type="email" required value={form.email} onChange={update('email')} autoComplete="email" placeholder="jordan.ellis@agency.gov" />
                <Input label="Username" required value={form.username} onChange={update('username')} autoComplete="username" placeholder="j.ellis" />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Password" type="password" required minLength={8} value={form.password} onChange={update('password')} autoComplete="new-password" hint="Minimum 8 characters" />
                    <Input label="Confirm password" type="password" required minLength={8} value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Department" value={form.department} onChange={update('department')} options={['Administration', 'Financial Crime', 'Criminal Investigation', 'Cyber Crime', 'Operations', 'Legal', 'Forensics', 'Traffic']} />
                    <Select
                        label="Role"
                        value={form.role}
                        onChange={update('role')}
                        options={SELF_ASSIGNABLE_ROLES}
                        hint="Supervisor and administrator roles are assigned by an administrator."
                    />
                </div>

                <InlineError message={error} />
                <InlineSuccess message={success} />

                <Button type="submit" icon={UserPlus} loading={pending} className="w-full" disabled={Boolean(success)}>
                    Create account
                </Button>
            </form>

            {mfaSetup?.secret ? (
                <div className="mt-5 rounded-lg border cv-divider bg-ink-50 p-3 text-xs dark:bg-ink-800/60">
                    <p className="font-bold text-ink-800 dark:text-ink-100">Authenticator setup</p>
                    <p className="mt-1 text-ink-600 dark:text-ink-300">Add this secret to your authenticator app, then sign in to complete enrolment.</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[0.7rem] text-ink-700 dark:bg-ink-900 dark:text-ink-200">{mfaSetup.secret}</code>
                        <Button
                            size="sm"
                            variant="secondary"
                            icon={Copy}
                            onClick={() => {
                                navigator.clipboard?.writeText(mfaSetup.secret);
                                toast.info('Secret copied to clipboard.');
                            }}
                        >
                            Copy
                        </Button>
                    </div>
                    {mfaSetup.otpAuthUrl ? (
                        <p className="mt-2 break-all text-[0.65rem] text-ink-500 dark:text-ink-400">{mfaSetup.otpAuthUrl}</p>
                    ) : null}
                    <Button className="mt-3 w-full" onClick={() => navigate('/login')} icon={UserPlus}>
                        Go to sign in
                    </Button>
                </div>
            ) : null}
        </AuthShell>
    );
}
