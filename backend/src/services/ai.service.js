import { env } from '../config/env.js';
import { sha256Hash } from './security-core.js';
import { canAccessResource, findCaseForUser, findDocumentForUser } from './authorization.service.js';
import { readCollection } from './store.js';

const analysisVersion = 'local-deterministic-v1';

function source(type, record, excerpt) {
    return {
        type,
        id: record.id,
        caseId: record.caseId || record.id,
        title: record.title || record.fileName || record.description || record.id,
        excerpt: String(excerpt || record.description || record.title || '').slice(0, 240),
    };
}

function authorizedSources(user, caseRecord) {
    return Promise.all([
        readCollection('documents'),
        readCollection('evidence'),
        readCollection('tasks'),
        readCollection('documentShares'),
    ]).then(([documents, evidence, tasks, shares]) => {
        const inCase = (item) => item.caseId === caseRecord.id && !item.deletedAt;
        return {
            documents: documents.filter((item) => inCase(item) && canAccessResource(user, { ...item, shares: shares.filter((share) => share.documentId === item.id) }, caseRecord)),
            evidence: evidence.filter((item) => inCase(item) && canAccessResource(user, item, caseRecord)),
            tasks: tasks.filter((item) => inCase(item) && canAccessResource(user, item, caseRecord, { permission: 'task:read' })),
        };
    });
}

function buildLocalAnalysis(caseRecord, sources, prompt) {
    const sourceDigest = sha256Hash(JSON.stringify({
        caseId: caseRecord.id,
        title: caseRecord.title,
        description: caseRecord.description,
        status: caseRecord.status,
        priority: caseRecord.priority,
        sources,
        prompt: String(prompt || '').trim(),
    }));
    const evidenceSignals = sources.evidence.map((item) => `${item.type}:${item.status}`).sort();
    const documentSignals = sources.documents.map((item) => `${item.category}:${item.status}`).sort();
    const taskSignals = sources.tasks.map((item) => item.status).sort();
    const findings = [
        `Case status is ${caseRecord.status}.`,
        `${sources.documents.length} authorized document record(s) and ${sources.evidence.length} authorized evidence record(s) are available.`,
        evidenceSignals.length ? `Evidence signals: ${evidenceSignals.join(', ')}.` : 'No authorized evidence signals were available for this analysis.',
        documentSignals.length ? `Document signals: ${documentSignals.join(', ')}.` : 'No authorized document signals were available for this analysis.',
        taskSignals.length ? `Task signals: ${taskSignals.join(', ')}.` : 'No authorized task signals were available for this analysis.',
    ];
    const citations = [
        source('case', caseRecord, caseRecord.description),
        ...sources.documents.map((item) => source('document', item, `${item.category}; ${item.status}`)),
        ...sources.evidence.map((item) => source('evidence', item, `${item.type}; ${item.status}`)),
        ...sources.tasks.map((item) => source('task', item, item.title)),
    ];
    return {
        analysisId: `AI-${sourceDigest.slice(0, 16).toUpperCase()}`,
        analysisVersion,
        provider: 'local-mock',
        mode: 'deterministic',
        outputLabel: 'DETERMINISTIC LOCAL ANALYSIS — NOT AN AUTHORITATIVE LEGAL CONCLUSION',
        disclaimer: 'This local mock output is deterministic and requires investigator review.',
        inputDigest: sourceDigest,
        prompt: String(prompt || '').trim().slice(0, 500),
        summary: findings.join(' '),
        findings,
        citations,
        authorizedSourceCount: citations.length,
    };
}

async function runProviderHook(localResult, providerHook) {
    if (typeof providerHook !== 'function') return localResult;
    const providerResult = await providerHook(localResult);
    if (!providerResult || typeof providerResult !== 'object') return localResult;
    return {
        ...localResult,
        provider: String(providerResult.provider || 'optional-provider'),
        providerMode: 'provider-hook',
        providerSummary: String(providerResult.summary || localResult.summary).slice(0, 4000),
        outputLabel: 'PROVIDER OUTPUT — LOCAL SAFETY AND SOURCE CHECKS APPLIED',
    };
}

export async function analyzeCase({ user, caseId, prompt = '', providerHook } = {}) {
    const caseRecord = await findCaseForUser(user, caseId);
    const sources = await authorizedSources(user, caseRecord);
    const localResult = buildLocalAnalysis(caseRecord, sources, prompt);
    const hook = providerHook || globalThis.CaseVaultAIProviderHook;
    return runProviderHook(localResult, hook);
}

export async function analyzeDocument({ user, documentId, providerHook } = {}) {
    const shares = (await readCollection('documentShares')).filter((share) => share.documentId === documentId);
    const { document, relatedCase } = await findDocumentForUser(user, documentId, { shares });
    const caseRecord = relatedCase || await findCaseForUser(user, document.caseId);
    const sources = await authorizedSources(user, caseRecord);
    const localResult = {
        analysisId: `AI-${sha256Hash(JSON.stringify({ documentId: document.id, hash: document.registeredHash })).slice(0, 16).toUpperCase()}`,
        analysisVersion,
        provider: 'local-mock',
        mode: 'deterministic',
        scope: 'document',
        documentId: document.id,
        caseId: document.caseId,
        outputLabel: 'DETERMINISTIC LOCAL ANALYSIS — NOT AN AUTHORITATIVE LEGAL CONCLUSION',
        disclaimer: 'Extracted signals are derived from authorized document metadata only. Verify against the source document.',
        summary: `${document.fileName} (version ${document.version}) is classified as ${document.category} with ${document.classification} handling, integrity status ${document.integrityStatus} and review status ${document.status}.`,
        findings: [
            `Registered SHA-256 integrity hash is present and was last verified ${document.lastVerified || 'not yet verified'}.`,
            `Approval state is ${document.status}${document.approvedAt ? ` (approved ${document.approvedAt})` : ''}.`,
            `The owning case is ${caseRecord?.caseNumber || document.caseNumber || 'unknown'} with status ${caseRecord?.status || 'unknown'}.`,
            `Active document shares visible to the requesting user: ${shares.filter((share) => !share.revokedAt && share.sharedWithId === user.id).length}.`,
        ],
        citations: [source('document', document, `${document.category}; ${document.status}`), source('case', caseRecord || { id: document.caseId }, caseRecord?.description)],
        authorizedSourceCount: 2,
    };
    const hook = providerHook || globalThis.CaseVaultAIProviderHook;
    return runProviderHook(localResult, hook);
}

export async function summarizeCase({ user, caseId, providerHook } = {}) {
    const caseRecord = await findCaseForUser(user, caseId);
    const sources = await authorizedSources(user, caseRecord);
    const localResult = {
        analysisId: `AI-${sha256Hash(JSON.stringify({ caseId, summary: true })).slice(0, 16).toUpperCase()}`,
        analysisVersion,
        provider: 'local-mock',
        mode: 'deterministic',
        scope: 'case-summary',
        caseId,
        outputLabel: 'AI-GENERATED — VERIFY AGAINST SOURCE DOCUMENTS',
        disclaimer: 'This summary is generated from authorized case records only and is not verified legal fact.',
        summary: `${caseRecord.caseNumber} (${caseRecord.title}) is a ${caseRecord.priority} priority ${caseRecord.type} case in ${caseRecord.status} status, owned by ${caseRecord.department}.`,
        sections: {
            caseOverview: `${caseRecord.caseNumber} — ${caseRecord.title}. Status ${caseRecord.status}, priority ${caseRecord.priority}, classification ${caseRecord.classification}, department ${caseRecord.department}, assigned officer ${caseRecord.assignedOfficer || 'unassigned'}.`,
            keyEvents: (sources.documents.length + sources.evidence.length
                ? [
                    ...sources.documents.map((item) => `Document ${item.fileName} v${item.version} is ${item.status.toLowerCase()} (${item.category}).`),
                    ...sources.evidence.map((item) => `Evidence ${item.id} (${item.type}) is ${String(item.status).toLowerCase()} and held by ${item.currentCustodian || 'unassigned custodian'}.`),
                ]
                : ['No authorized documents or evidence were available for this summary.']),
            importantPeople: [caseRecord.assignedOfficer ? `Assigned officer: ${caseRecord.assignedOfficer}.` : 'No officer is assigned to this case.'],
            evidenceSummary: sources.evidence.length
                ? `${sources.evidence.length} authorized evidence record(s) on file.`
                : 'No authorized evidence records are available.',
            importantDocuments: sources.documents.length
                ? sources.documents.slice(0, 6).map((item) => `${item.fileName} v${item.version} — ${item.category} (${item.status}).`)
                : ['No authorized documents are available.'],
            outstandingActions: sources.tasks.filter((item) => item.status !== 'Completed' && item.status !== 'Cancelled').map((item) => `${item.title} (${item.status})`),
            potentialMissingInformation: [
                sources.documents.some((item) => item.integrityStatus !== 'VERIFIED') ? 'At least one document has not had its integrity verified yet.' : null,
                sources.evidence.some((item) => item.status === 'Registered') ? 'At least one evidence item is still pending storage confirmation.' : null,
                !caseRecord.assignedOfficerId ? 'No investigating officer is assigned.' : null,
                sources.tasks.length === 0 ? 'No case tasks exist for follow-up tracking.' : null,
            ].filter(Boolean),
        },
        citations: [
            source('case', caseRecord, caseRecord.description),
            ...sources.documents.map((item) => source('document', item, `${item.category}; ${item.status}`)),
            ...sources.evidence.map((item) => source('evidence', item, `${item.type}; ${item.status}`)),
        ],
        authorizedSourceCount: 1 + sources.documents.length + sources.evidence.length,
    };
    const hook = providerHook || globalThis.CaseVaultAIProviderHook;
    return runProviderHook(localResult, hook);
}

function scoreCitation(record, tokens) {
    const haystack = [record.id, record.title, record.fileName, record.description, record.category, record.type, record.caseNumber, record.status, record.currentCustodian, record.location]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
    return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

export async function answerCaseQuestion({ user, caseId, question, providerHook } = {}) {
    const caseRecord = await findCaseForUser(user, caseId);
    const sources = await authorizedSources(user, caseRecord);
    const tokens = String(question || '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
    const scored = [
        ...sources.documents.map((record) => ({ type: 'document', record, score: scoreCitation(record, tokens) })),
        ...sources.evidence.map((record) => ({ type: 'evidence', record, score: scoreCitation(record, tokens) })),
        ...sources.tasks.map((record) => ({ type: 'task', record, score: scoreCitation(record, tokens) })),
    ].filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score).slice(0, 8);

    const citations = scored.map((entry) => source(entry.type, entry.record, entry.record.description || entry.record.fileName || entry.record.title));
    const localResult = {
        analysisId: `AI-${sha256Hash(JSON.stringify({ caseId, question, sources: citations.map((item) => item.id) })).slice(0, 16).toUpperCase()}`,
        analysisVersion,
        provider: 'local-mock',
        mode: 'deterministic',
        scope: 'case-question',
        caseId,
        question: String(question || '').trim().slice(0, 500),
        outputLabel: 'AI-GENERATED — SOURCE-BACKED ANSWER',
        disclaimer: 'Answers are composed only from authorized case records. Verify against the cited sources before relying on them.',
        answer: citations.length
            ? `Based on ${citations.length} authorized source record(s) in ${caseRecord.caseNumber}: ${citations.map((citation) => `${citation.title} (${citation.type})`).join('; ')}.`
            : 'Not found in available documents. No authorized case record matched this question.',
        findings: citations.length
            ? citations.map((citation) => `${citation.type.toUpperCase()}: ${citation.title} — ${citation.excerpt}`)
            : ['Not found in available documents.'],
        citations,
        authorizedSourceCount: citations.length,
    };
    const hook = providerHook || globalThis.CaseVaultAIProviderHook;
    return runProviderHook(localResult, hook);
}

export async function analyzeWorkspace({ user, query = '', providerHook } = {}) {
    const [cases, documents, evidence] = await Promise.all([readCollection('cases'), readCollection('documents'), readCollection('evidence')]);
    const authorizedCases = cases.filter((item) => !item.deletedAt && canAccessResource(user, item));
    const caseIds = new Set(authorizedCases.map((item) => item.id));
    const authorizedDocuments = documents.filter((item) => caseIds.has(item.caseId) && canAccessResource(user, item, authorizedCases.find((caseItem) => caseItem.id === item.caseId)));
    const authorizedEvidence = evidence.filter((item) => caseIds.has(item.caseId) && canAccessResource(user, item, authorizedCases.find((caseItem) => caseItem.id === item.caseId)));
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const filteredCases = authorizedCases.filter((item) => !normalizedQuery || [item.id, item.caseNumber, item.title, item.description].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
    const localResult = {
        analysisId: `AI-${sha256Hash(JSON.stringify({ query: normalizedQuery, cases: filteredCases.map((item) => item.id), documents: authorizedDocuments.map((item) => item.id), evidence: authorizedEvidence.map((item) => item.id) })).slice(0, 16).toUpperCase()}`,
        analysisVersion,
        provider: 'local-mock',
        mode: 'deterministic',
        outputLabel: 'DETERMINISTIC LOCAL ANALYSIS — AUTHORIZED SOURCES ONLY',
        disclaimer: 'This local mock output is deterministic and is not a legal or investigative conclusion.',
        query: String(query || '').trim().slice(0, 500),
        summary: `${filteredCases.length} authorized case(s), ${authorizedDocuments.length} authorized document record(s), and ${authorizedEvidence.length} authorized evidence record(s) matched the authorized workspace.`,
        citations: [
            ...filteredCases.map((item) => source('case', item, item.description)),
            ...authorizedDocuments.map((item) => source('document', item, `${item.category}; ${item.status}`)),
            ...authorizedEvidence.map((item) => source('evidence', item, `${item.type}; ${item.status}`)),
        ],
    };
    const hook = providerHook || globalThis.CaseVaultAIProviderHook;
    return runProviderHook(localResult, hook);
}

export function configureProviderHook(hook) {
    globalThis.CaseVaultAIProviderHook = typeof hook === 'function' ? hook : null;
    return Boolean(env.aiProviderHook);
}
