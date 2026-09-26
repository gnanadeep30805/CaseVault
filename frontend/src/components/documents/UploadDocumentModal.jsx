import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Input, Select } from '../ui/Form.jsx';
import { InlineError } from '../ui/States.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../../lib/apiClient.js';
import { CLASSIFICATIONS, DOCUMENT_CATEGORIES } from '../../lib/capabilities.js';
import { formatBytes } from '../../lib/format.js';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.xml', '.txt', '.csv', '.doc', '.docx', '.xlsx'];
const MAX_BYTES = 10 * 1024 * 1024;

export default function UploadDocumentModal({ open, onClose, onUploaded, caseId, cases = null }) {
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [caseSelection, setCaseSelection] = useState('');
    const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0]);
    const [classification, setClassification] = useState('CONFIDENTIAL');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const caseList = useResource(() => api.get('/cases').then(unwrap), [], { enabled: open && !caseId });

    useEffect(() => {
        if (open) {
            setCaseSelection(caseId || '');
            setError('');
            setFile(null);
        }
    }, [open, caseId]);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!file) {
            setError('Select a file to upload.');
            return;
        }
        const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            setError(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`);
            return;
        }
        if (file.size > MAX_BYTES) {
            setError(`The file exceeds the ${formatBytes(MAX_BYTES)} upload limit.`);
            return;
        }
        const targetCase = caseId || caseSelection;
        if (!targetCase) {
            setError('Select the case this document belongs to.');
            return;
        }
        const form = new FormData();
        form.append('file', file);
        form.append('caseId', targetCase);
        form.append('category', category);
        form.append('classification', classification);
        setSaving(true);
        try {
            const created = await api.post('/documents', form).then(unwrap);
            toast.success(`${created?.fileName || 'Document'} uploaded and hash-registered.`);
            onUploaded?.(created);
            onClose();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The upload could not be completed.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Upload document"
            description="Files are encrypted at rest, hashed with SHA-256 and signed with Ed25519 on arrival."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="upload-document-form" icon={Upload} loading={saving}>Upload</Button>
                </>
            )}
        >
            <form id="upload-document-form" onSubmit={submit} className="space-y-4" noValidate>
                {!caseId ? (
                    <Select
                        label="Case"
                        required
                        value={caseSelection}
                        onChange={(event) => setCaseSelection(event.target.value)}
                        placeholder={caseList.loading ? 'Loading cases…' : 'Select a case'}
                        options={(cases || caseList.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))}
                    />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={DOCUMENT_CATEGORIES} />
                    <Select label="Classification" value={classification} onChange={(event) => setClassification(event.target.value)} options={CLASSIFICATIONS} />
                </div>
                <Input
                    label="File"
                    type="file"
                    required
                    accept={ALLOWED_EXTENSIONS.join(',')}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    hint={`Accepted: ${ALLOWED_EXTENSIONS.join(', ')} · maximum ${formatBytes(MAX_BYTES)}`}
                />
                {file ? (
                    <p className="text-xs font-semibold text-ink-600 dark:text-ink-300">
                        Selected: {file.name} ({formatBytes(file.size)})
                    </p>
                ) : null}
                <InlineError message={error} />
            </form>
        </Modal>
    );
}
