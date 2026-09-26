import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bot, FileSearch, FolderKanban, Send, Sparkles } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Input, Select } from '../components/ui/Form.jsx';
import { Card, CardBody, CardHeader, SectionTitle } from '../components/ui/Card.jsx';
import { InlineError, PermissionNotice } from '../components/ui/States.jsx';
import AiResultCard from '../components/ai/AiResultCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { formatDateTime } from '../lib/format.js';

const STARTERS = [
    'Summarise the current case activity',
    'Which evidence items have not been verified yet?',
    'List outstanding tasks and their owners',
    'What is the status of every document in this case?',
];

function Conversation({ messages, pending }) {
    const endRef = useRef(null);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, pending]);
    return (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 cv-scroll">
            {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={message.role === 'user' ? 'max-w-[85%] rounded-lg bg-brand-500 px-3 py-2 text-sm text-white' : 'w-full max-w-[95%] space-y-2'}>
                        {message.role === 'user' ? (
                            <p>{message.content}</p>
                        ) : (
                            <AiResultCard result={message.result} title="Case-grounded answer" />
                        )}
                    </div>
                </div>
            ))}
            {pending ? <p className="text-xs text-ink-500 dark:text-ink-400" role="status">Analysing authorized sources…</p> : null}
            <div ref={endRef} />
        </div>
    );
}

export default function AssistantPage() {
    const toast = useToast();
    useDocumentTitle('AI Assistant');
    const [params, setParams] = useSearchParams();

    const [caseId, setCaseId] = useState(params.get('caseId') || '');
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [pending, setPending] = useState(false);
    const [summary, setSummary] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [error, setError] = useState('');

    const cases = useResource(() => api.get('/cases').then(unwrap), []);
    const caseOptions = useMemo(
        () => (cases.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` })),
        [cases.data],
    );

    useEffect(() => {
        const next = params.get('caseId');
        if (next) setCaseId(next);
    }, [params]);

    const selectCase = (value) => {
        setCaseId(value);
        setSummary(null);
        setMessages([]);
        setWorkspace(null);
        setError('');
        setParams(value ? { caseId: value } : {});
    };

    const runSummary = async () => {
        if (!caseId) {
            setError('Select a case first.');
            return;
        }
        setPending(true);
        setError('');
        try {
            setSummary(await api.post(`/ai/cases/${encodeURIComponent(caseId)}/summarize`, {}).then(unwrap));
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The case summary could not be generated.'));
        } finally {
            setPending(false);
        }
    };

    const runWorkspace = async () => {
        setPending(true);
        setError('');
        try {
            setWorkspace(await api.get('/ai/workspace', { params: question ? { q: question } : {} }).then(unwrap));
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The workspace scan could not be completed.'));
        } finally {
            setPending(false);
        }
    };

    const ask = async (event) => {
        event?.preventDefault();
        const text = question.trim();
        if (!text || !caseId || pending) return;
        const entry = { id: `${Date.now()}-user`, role: 'user', content: text };
        setMessages((current) => [...current, entry]);
        setQuestion('');
        setPending(true);
        setError('');
        try {
            const result = await api.post(`/ai/cases/${encodeURIComponent(caseId)}/chat`, { question: text }).then(unwrap);
            setMessages((current) => [...current, { id: `${Date.now()}-ai`, role: 'assistant', result }]);
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The question could not be answered.'));
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="AI assistant"
                description="Deterministic analysis restricted to the cases, documents and evidence your role is authorized to read. Every answer cites its sources and requires investigator review."
            />

            <PermissionNotice message="This deployment runs the local deterministic analysis provider because no external AI credentials are configured. Output is clearly labelled and must never be treated as verified legal fact." />

            <Card>
                <CardBody className="grid gap-3 sm:grid-cols-3">
                    <Select
                        label="Case context"
                        value={caseId}
                        onChange={(event) => selectCase(event.target.value)}
                        placeholder="Select a case"
                        options={caseOptions}
                    />
                    <div className="flex items-end">
                        <Button variant="secondary" icon={Sparkles} loading={pending} disabled={!caseId} onClick={runSummary} className="w-full">Summarise case</Button>
                    </div>
                    <div className="flex items-end">
                        <Button variant="ghost" icon={FileSearch} loading={pending} onClick={runWorkspace} className="w-full">Scan my workspace</Button>
                    </div>
                </CardBody>
            </Card>

            {error ? <InlineError message={error} /> : null}

            {summary ? <AiResultCard result={summary} title="Case summary" icon={FolderKanban} /> : null}
            {workspace ? <AiResultCard result={workspace} title="Authorized workspace scan" icon={FileSearch} /> : null}

            <Card>
                <CardHeader
                    title="Ask a case question"
                    icon={Bot}
                    description={caseId ? 'Answers are composed from the authorized records of the selected case only.' : 'Select a case to enable questions.'}
                />
                <CardBody className="space-y-4">
                    {messages.length === 0 && caseId ? (
                        <div className="flex flex-wrap gap-2">
                            {STARTERS.map((starter) => (
                                <Button key={starter} variant="ghost" size="sm" onClick={() => setQuestion(starter)}>{starter}</Button>
                            ))}
                        </div>
                    ) : null}

                    <Conversation messages={messages} pending={pending} />

                    <form onSubmit={ask} className="flex items-end gap-2">
                        <div className="flex-1">
                            <Input
                                label="Question"
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder="e.g. Which exhibits are still awaiting storage confirmation?"
                                disabled={!caseId}
                                maxLength={500}
                            />
                        </div>
                        <Button type="submit" icon={Send} loading={pending} disabled={!caseId || !question.trim()}>Ask</Button>
                    </form>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="How this assistant works" />
                <CardBody>
                    <ul className="list-disc space-y-1.5 pl-5 text-xs text-ink-600 dark:text-ink-300">
                        <li>Only records your role, department and clearance already allow are read. Nothing is retrieved outside your authorization.</li>
                        <li>Every answer lists the exact source records it was composed from, linked for verification.</li>
                        <li>Output is deterministic and repeatable, so the same inputs always produce the same analysis.</li>
                        <li>Each request is written to the audit trail with the analysis ID, provider and citation count.</li>
                    </ul>
                    <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
                        Generated {formatDateTime(new Date().toISOString())} · never present AI output as verified legal fact.
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
