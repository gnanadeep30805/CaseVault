import { Link } from 'react-router-dom';
import { Bot, Quote } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { Card, CardBody, CardHeader, SectionTitle } from '../ui/Card.jsx';

const LINKS = {
    case: (id) => `/cases/${id}`,
    document: (id) => `/documents/${id}`,
    evidence: (id) => `/evidence/${id}`,
    task: (id) => `/cases/${id}`,
};

export function AiResultCard({ result, title = 'AI output', icon: Icon = Bot, children }) {
    if (!result) return null;
    return (
        <Card>
            <CardHeader
                title={title}
                icon={Icon}
                description={result.outputLabel || 'AI-GENERATED — VERIFY AGAINST SOURCE RECORDS'}
                actions={(
                    <span className="flex flex-wrap items-center gap-2 text-[0.68rem] text-ink-500 dark:text-ink-400">
                        <Badge value="info" label={String(result.provider || 'local').toUpperCase()} />
                        {result.analysisId ? <span className="font-mono">{result.analysisId}</span> : null}
                    </span>
                )}
            />
            <CardBody className="space-y-4">
                {result.summary ? <p className="text-sm text-ink-800 dark:text-ink-100">{result.summary}</p> : null}
                {result.providerSummary ? (
                    <div>
                        <SectionTitle>Provider output</SectionTitle>
                        <p className="mt-1 text-sm text-ink-800 dark:text-ink-100">{result.providerSummary}</p>
                    </div>
                ) : null}
                {result.answer ? <p className="text-sm text-ink-800 dark:text-ink-100">{result.answer}</p> : null}
                {children}
                {Array.isArray(result.sections) ? <SectionList sections={result.sections} /> : null}
                {result.sections && !Array.isArray(result.sections) ? <Sections sections={result.sections} /> : null}
                {Array.isArray(result.findings) && result.findings.length ? (
                    <div>
                        <SectionTitle>Findings</SectionTitle>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink-700 dark:text-ink-200">
                            {result.findings.map((finding) => <li key={finding}>{finding}</li>)}
                        </ul>
                    </div>
                ) : null}
                <Citations citations={result.citations} sourceCount={result.authorizedSourceCount} />
                {result.disclaimer ? <p className="text-[0.7rem] italic text-ink-500 dark:text-ink-400">{result.disclaimer}</p> : null}
            </CardBody>
        </Card>
    );
}

function Sections({ sections }) {
    const LABELS = {
        caseOverview: 'Case overview',
        keyEvents: 'Key events',
        importantPeople: 'Important people',
        evidenceSummary: 'Evidence summary',
        importantDocuments: 'Important documents',
        outstandingActions: 'Outstanding actions',
        potentialMissingInformation: 'Potential missing information',
    };
    return (
        <div className="space-y-3">
            {Object.entries(sections).map(([key, value]) => {
                const values = Array.isArray(value) ? value : [value];
                const items = values.filter((item) => item !== null && item !== undefined && String(item).trim());
                if (!items.length) return null;
                return (
                    <div key={key}>
                        <SectionTitle>{LABELS[key] || key}</SectionTitle>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink-700 dark:text-ink-200">
                            {items.map((item) => <li key={String(item)}>{String(item)}</li>)}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function SectionList({ sections }) {
    return (
        <div className="space-y-2">
            {sections.map((section) => (
                <div key={section.title}>
                    <SectionTitle>{section.title}</SectionTitle>
                    <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-200">{section.body}</p>
                </div>
            ))}
        </div>
    );
}

function Citations({ citations, sourceCount }) {
    if (!Array.isArray(citations) || !citations.length) return null;
    return (
        <div>
            <SectionTitle>{`Sources (${sourceCount ?? citations.length})`}</SectionTitle>
            <ul className="mt-1 space-y-1.5">
                {citations.map((citation) => {
                    const to = LINKS[citation.type]?.(citation.id);
                    const body = (
                        <>
                            <span className="font-semibold text-ink-700 dark:text-ink-200">{citation.type}</span>
                            <span className="mx-1 text-ink-400">·</span>
                            <span className="truncate">{citation.title}</span>
                            {citation.excerpt ? <span className="block text-[0.65rem] text-ink-500 dark:text-ink-400">{citation.excerpt}</span> : null}
                        </>
                    );
                    return (
                        <li key={citation.id} className="flex items-start gap-1.5 text-xs text-ink-600 dark:text-ink-300">
                            <Quote size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                            {to ? <Link to={to} className="cv-link min-w-0">{body}</Link> : <span className="min-w-0">{body}</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default AiResultCard;
