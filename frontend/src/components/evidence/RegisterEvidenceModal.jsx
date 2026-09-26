import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Input, Select, Textarea } from '../ui/Form.jsx';
import { InlineError } from '../ui/States.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../../lib/apiClient.js';
import { EVIDENCE_TYPES } from '../../lib/capabilities.js';

export default function RegisterEvidenceModal({ open, onClose, onRegistered, caseId, cases = null }) {
    const toast = useToast();
    const [form, setForm] = useState({
        caseId: '',
        type: EVIDENCE_TYPES[0],
        description: '',
        collectedBy: '',
        collectionDate: '',
        custodian: '',
        location: '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const caseList = useResource(() => api.get('/cases').then(unwrap), [], { enabled: open && !caseId });

    useEffect(() => {
        if (open) {
            setForm({
                caseId: caseId || '',
                type: EVIDENCE_TYPES[0],
                description: '',
                collectedBy: '',
                collectionDate: new Date().toISOString().slice(0, 10),
                custodian: '',
                location: '',
            });
            setError('');
        }
    }, [open, caseId]);

    const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        const targetCase = caseId || form.caseId;
        if (!targetCase) {
            setError('Select the case this evidence belongs to.');
            return;
        }
        setSaving(true);
        try {
            const created = await api.post('/evidence', {
                caseId: targetCase,
                type: form.type,
                description: form.description.trim(),
                collectedBy: form.collectedBy.trim(),
                collectionDate: form.collectionDate,
                custodian: form.custodian.trim() || undefined,
                location: form.location.trim() || undefined,
            }).then(unwrap);
            toast.success(`${created?.id || 'Evidence'} registered and signed.`);
            onRegistered?.(created);
            onClose();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to register the evidence item.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Register evidence"
            description="Registration creates a signed evidence record and an initial chain-of-custody entry."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="register-evidence-form" icon={Fingerprint} loading={saving}>Register</Button>
                </>
            )}
        >
            <form id="register-evidence-form" onSubmit={submit} className="space-y-4" noValidate>
                {!caseId ? (
                    <Select
                        label="Case"
                        required
                        value={form.caseId}
                        onChange={update('caseId')}
                        placeholder={caseList.loading ? 'Loading cases…' : 'Select a case'}
                        options={(cases || caseList.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))}
                    />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Evidence type" value={form.type} onChange={update('type')} options={EVIDENCE_TYPES} />
                    <Input label="Collection date" type="date" required value={form.collectionDate} onChange={update('collectionDate')} />
                </div>
                <Textarea label="Description" required value={form.description} onChange={update('description')} rows={3} placeholder="Describe the item, its condition and how it was obtained." />
                <div className="grid gap-4 sm:grid-cols-3">
                    <Input label="Collected by" required value={form.collectedBy} onChange={update('collectedBy')} placeholder="Officer name" />
                    <Input label="Custodian" value={form.custodian} onChange={update('custodian')} placeholder="Defaults to you" />
                    <Input label="Location" value={form.location} onChange={update('location')} placeholder="Evidence locker" />
                </div>
                <InlineError message={error} />
            </form>
        </Modal>
    );
}
