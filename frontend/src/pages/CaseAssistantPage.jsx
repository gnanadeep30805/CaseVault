import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, FolderKanban, Send, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Input } from '../components/ui/Form.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState, InlineError } from '../components/ui/States.jsx';
import { SkeletonText } from '../components/ui/Skeleton.jsx';
import AiResultCard from '../components/ai/AiResultCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';

export default function CaseAssistantPage() {
    const { caseId } = useParams();
    const toast = useToast();
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [summary, setSummary] = useState(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const endRef = useRef(null);

    const record = useResource(() => api.get(`/cases/${encodeURIComponent(caseId)}`).then(unwrap), [caseId]);
    useDocumentTitle(record.data ? `AI · ${record.data.caseNumber}` : 'Case assistant');

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, pending]);

    useEffect(() => {
        setSummary(null);
        setMessages([]);
        setError('');
    }, [caseId]);

    const runSummary = async () => {
        setPending(true);
        setError('');
        try {
            const result = await api.post(`/ai/cases/${encodeURIComponent(caseId)}/summarize`, {}).then(unwrap);
            setSummary(result);
        } catch (caught) {
            const message = apiErrorMessage(caught, 'The case summary could not be generated.');
            setError(message);
            toast.error(message);
        } finally {
            setPending(false);
        }
    };

    const ask = async (event) => {
        event.preventDefault();
        const text = question.trim();
        if (!text || pending) return;
        setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', content: text }]);
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

    if (record.loading && !record.data) {
        return <SkeletonText lines={6} />;
    }

    if (record.error) {
        return <ErrorState title="Case unavailable" message={apiErrorMessage(record.error, 'You may not have access to this case.')} onRetry={record.reload} />;
    }

    const item = record.data;
    if (!item) return null;

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-ink-500 dark:text-ink-400">
                        <Link to={`/cases/${item.id}`} className="cv-link inline-flex items-center gap-1.5">
                            <ArrowLeft size={12} aria-hidden="true" />
                            {item.caseNumber}
                        </Link>
                    </div>
                    <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-2xl">Case AI assistant</h1>
                    <p className="mt-1 max-w-3xl text-sm text-ink-500 dark:text-ink-400">
                        Analysis limited to {item.caseNumber} — {item.title} and the records you are authorized to read.
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge value={item.status} />
                        <Badge value={item.priority} />
                        <Badge value={item.classification} />
                    </p>
                </div>
                <Button icon={Sparkles} loading={pending} onClick={runSummary}>Generate case summary</Button>
            </header>

            {error ? <InlineError message={error} /> : null}

            {summary ? <AiResultCard result={summary} title="Case summary" icon={FolderKanban} /> : null}

            <Card>
                <CardHeader title="Ask about this case" icon={Bot} description="Answers cite the exact authorized records they were composed from." />
                <CardBody className="space-y-4">
                    <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 cv-scroll">
                        {messages.length === 0 ? (
                            <p className="py-4 text-center text-xs text-ink-500 dark:text-ink-400">
                                Ask a question about the documents, evidence, timeline or tasks in {item.caseNumber}.
                            </p>
                        ) : messages.map((message) => (
                            <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                                {message.role === 'user' ? (
                                    <p className="max-w-[85%] rounded-lg bg-brand-500 px-3 py-2 text-sm text-white">{message.content}</p>
                                ) : (
                                    <div className="w-full max-w-[95%]">
                                        <AiResultCard result={message.result} title="Case-grounded answer" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {pending ? <p className="text-xs text-ink-500 dark:text-ink-400" role="status">Analysing authorized sources…</p> : null}
                        <div ref={endRef} />
                    </div>

                    <form onSubmit={ask} className="flex items-end gap-2">
                        <div className="flex-1">
                            <Input
                                label="Question"
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder="What still needs investigator action on this case?"
                                maxLength={500}
                            />
                        </div>
                        <Button type="submit" icon={Send} loading={pending} disabled={!question.trim()}>Ask</Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
