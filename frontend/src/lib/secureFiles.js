import { api } from './apiClient.js';

const objectUrls = new Map();

function releaseUrl(key) {
    const existing = objectUrls.get(key);
    if (existing) {
        URL.revokeObjectURL(existing);
        objectUrls.delete(key);
    }
}

export async function fetchDocumentBlob(documentId, disposition = 'preview') {
    const response = await api.get(`/documents/${encodeURIComponent(documentId)}/${disposition}`, { responseType: 'blob', timeout: 60000 });
    const type = response.headers['content-type'] || 'application/octet-stream';
    return { blob: response.data, type, size: response.data.size };
}

export function safeFileName(name, fallback = 'document') {
    const cleaned = String(name || '').replace(/[^\w.\-() ]+/g, '_').trim();
    return cleaned || fallback;
}

export async function downloadSecureDocument(documentId, fileName, disposition = 'download') {
    const { blob } = await fetchDocumentBlob(documentId, disposition);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFileName(fileName);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function openSecurePreview(documentId, fileName) {
    const { blob, type } = await fetchDocumentBlob(documentId, 'preview');
    const key = `preview:${documentId}`;
    releaseUrl(key);
    const url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    return { url, type };
}

export function previewKindFor(document) {
    const extension = String(document?.extension || document?.fileName || '').split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg'].includes(extension)) return 'image';
    if (['txt', 'csv', 'xml'].includes(extension)) return 'text';
    return 'binary';
}
