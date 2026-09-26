import { useState } from 'react';
import { Building2, Fingerprint, KeyRound, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Input } from '../components/ui/Form.jsx';
import { Card, CardBody, CardHeader, KeyValue } from '../components/ui/Card.jsx';
import { InlineError, InlineSuccess } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useResource.js';
import { api, apiErrorMessage, tokenStore } from '../lib/apiClient.js';
import { formatDateTime, formatRelative, initials } from '../lib/format.js';

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ProfilePage() {
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    useDocumentTitle('Profile');

    const [name, setName] = useState(user?.name || '');
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileError, setProfileError] = useState('');

    const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordNotice, setPasswordNotice] = useState('');

    const saveProfile = async (event) => {
        event.preventDefault();
        setProfileError('');
        setProfileBusy(true);
        try {
            await api.patch('/users/me', { name: name.trim() });
            await refreshProfile();
            toast.success('Profile updated.');
        } catch (error) {
            setProfileError(apiErrorMessage(error, 'Your profile could not be updated.'));
        } finally {
            setProfileBusy(false);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        setPasswordError('');
        setPasswordNotice('');
        if (form.newPassword !== form.confirmPassword) {
            setPasswordError('The two new passwords do not match.');
            return;
        }
        setPasswordBusy(true);
        try {
            const result = await api.post('/auth/change-password', {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
                refreshToken: tokenStore.refreshToken,
            });
            setPasswordNotice(result?.data?.data?.message || 'Password changed. Other active sessions were signed out.');
            setForm(EMPTY_PASSWORD_FORM);
            toast.success('Password changed.');
        } catch (error) {
            setPasswordError(apiErrorMessage(error, 'The password could not be changed.'));
        } finally {
            setPasswordBusy(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-5">
            <PageHeader title="Profile" description="Your account details, clearance and password." />

            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardBody className="flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-lg font-bold text-brand-500">
                            {initials(user.name)}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-base font-bold text-ink-900 dark:text-ink-50">{user.name}</p>
                            <p className="truncate text-xs text-ink-500 dark:text-ink-400">{user.email}</p>
                            <p className="mt-1 flex flex-wrap gap-1.5">
                                <Badge value={user.role} tone="info" />
                                <Badge value={user.status} />
                            </p>
                        </div>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader title="Account" icon={UserIcon} />
                    <CardBody>
                        <KeyValue
                            columns={2}
                            items={[
                                { label: 'Username', value: user.username },
                                { label: 'Department', value: <span className="inline-flex items-center gap-1.5"><Building2 size={12} aria-hidden="true" />{user.department}</span> },
                                { label: 'Clearance', value: <span className="inline-flex items-center gap-1.5"><Fingerprint size={12} aria-hidden="true" />{user.clearance}</span> },
                                { label: 'MFA', value: <Badge value={user.mfaEnabled ? 'Enabled' : 'Disabled'} tone={user.mfaEnabled ? 'success' : 'warning'} /> },
                                { label: 'Email', value: <span className="inline-flex items-center gap-1.5"><Mail size={12} aria-hidden="true" />{user.email}</span> },
                                { label: 'Last sign-in', value: user.lastLogin ? formatRelative(user.lastLogin) : 'This session' },
                            ]}
                        />
                    </CardBody>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Display name" icon={UserIcon} description="Your name is shown on cases, tasks, timeline entries and audit events you create." />
                    <CardBody>
                        <form onSubmit={saveProfile} className="space-y-3" noValidate>
                            <Input label="Full name" required value={name} onChange={(event) => setName(event.target.value)} />
                            <InlineError message={profileError} />
                            <Button type="submit" loading={profileBusy} disabled={!name.trim() || name.trim() === user.name}>Save name</Button>
                        </form>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Change password" icon={KeyRound} description="At least 10 characters with upper case, lower case and a digit." />
                    <CardBody>
                        <form onSubmit={changePassword} className="space-y-3" noValidate>
                            <Input
                                label="Current password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={form.currentPassword}
                                onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
                            />
                            <Input
                                label="New password"
                                type="password"
                                required
                                autoComplete="new-password"
                                value={form.newPassword}
                                onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
                            />
                            <Input
                                label="Confirm new password"
                                type="password"
                                required
                                autoComplete="new-password"
                                value={form.confirmPassword}
                                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                            />
                            <InlineError message={passwordError} />
                            <InlineSuccess message={passwordNotice} />
                            <Button type="submit" icon={ShieldCheck} loading={passwordBusy} disabled={!form.currentPassword || !form.newPassword}>
                                Change password
                            </Button>
                        </form>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader title="Effective permissions" icon={ShieldCheck} description="Granted by your role on the server. The UI hides what you cannot use, and the API rejects it regardless." />
                <CardBody>
                    <p className="text-sm text-ink-700 dark:text-ink-200">
                        Role <span className="font-semibold">{user.role}</span> in <span className="font-semibold">{user.department}</span> with{' '}
                        <span className="font-semibold">{user.clearance}</span> clearance.
                    </p>
                    <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                        Account created {formatDateTime(user.createdAt)} · last sign-in {user.lastLogin ? formatDateTime(user.lastLogin) : 'this session'}.
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
