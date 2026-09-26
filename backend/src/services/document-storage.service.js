import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { decryptBuffer, encryptBuffer, HASH_ALGORITHM, sha256Hash } from './security-core.js';
import { getSecureStorageDirectory, getSecureStoragePath } from './store.js';

const allowedTypes = {
    '.pdf': new Set(['application/pdf']),
    '.png': new Set(['image/png']),
    '.jpg': new Set(['image/jpeg']),
    '.jpeg': new Set(['image/jpeg']),
    '.xml': new Set(['application/xml', 'text/xml']),
    '.txt': new Set(['text/plain']),
    '.csv': new Set(['text/csv', 'application/csv']),
    '.doc': new Set(['application/msword']),
    '.docx': new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    '.xlsx': new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
};

export const allowedDocumentExtensions = Object.keys(allowedTypes);

function validationError(code, message, status = 422) {
    return Object.assign(new Error(message), { code, status });
}

function normalizeMimeType(value) {
    return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

export function inferMimeType(fileName) {
    const extension = path.extname(String(fileName || '')).toLowerCase();
    if (extension === '.pdf') return 'application/pdf';
    if (extension === '.png') return 'image/png';
    if (['.jpg', '.jpeg'].includes(extension)) return 'image/jpeg';
    if (extension === '.xml') return 'application/xml';
    if (extension === '.csv') return 'text/csv';
    if (['.txt'].includes(extension)) return 'text/plain';
    if (extension === '.doc') return 'application/msword';
    if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (extension === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return '';
}

export function validateUpload({ fileName, mimeType, size, buffer }) {
    const normalizedName = String(fileName || '').trim();
    if (!normalizedName || normalizedName.length > 255 || normalizedName.includes('\0') || /[\\/]/.test(normalizedName) || normalizedName.includes('..') || /%2f|%5c/i.test(normalizedName)) {
        throw validationError('INVALID_FILE_NAME', 'A safe file name without path traversal is required.', 422);
    }
    const extension = path.extname(normalizedName).toLowerCase();
    if (!allowedTypes[extension]) throw validationError('UNSUPPORTED_FILE_TYPE', 'This file extension is not supported.', 415);
    const normalizedMime = normalizeMimeType(mimeType);
    if (!normalizedMime || !allowedTypes[extension].has(normalizedMime)) {
        throw validationError('MIME_TYPE_MISMATCH', 'The file MIME type does not match its extension.', 415);
    }
    const byteLength = Number.isFinite(Number(size)) ? Number(size) : Buffer.byteLength(buffer || Buffer.alloc(0));
    if (byteLength <= 0) throw validationError('EMPTY_FILE', 'The uploaded file is empty.', 422);
    if (byteLength > env.documentMaxSize || Buffer.byteLength(buffer || Buffer.alloc(0)) > env.documentMaxSize) {
        throw validationError('FILE_TOO_LARGE', `The file exceeds the ${Math.floor(env.documentMaxSize / (1024 * 1024))} MB limit.`, 413);
    }
    if (Buffer.byteLength(buffer || Buffer.alloc(0)) !== byteLength) throw validationError('INVALID_FILE_CONTENT', 'The uploaded file size is inconsistent.', 422);
    return { fileName: normalizedName, extension, mimeType: normalizedMime, size: byteLength, buffer: Buffer.from(buffer) };
}

function getRequestFile(req) {
    if (req.file) return req.file;
    if (Array.isArray(req.files)) return req.files[0];
    if (req.files && typeof req.files === 'object') {
        const firstField = Object.values(req.files)[0];
        if (Array.isArray(firstField)) return firstField[0];
        return firstField;
    }
    return null;
}

export function getUploadPayload(req) {
    const file = getRequestFile(req);
    if (file) {
        return validateUpload({ fileName: file.originalname, mimeType: file.mimetype, size: file.size, buffer: file.buffer });
    }
    const body = req.body || {};
    if (body.content == null) throw validationError('FILE_REQUIRED', 'A multipart file field is required.', 422);
    let buffer;
    if (body.encoding === 'base64' || body.contentEncoding === 'base64') {
        try {
            buffer = Buffer.from(String(body.content), 'base64');
        } catch {
            throw validationError('INVALID_FILE_CONTENT', 'The base64 file content is invalid.', 422);
        }
    } else {
        buffer = Buffer.from(String(body.content), 'utf8');
    }
    return validateUpload({ fileName: body.fileName, mimeType: body.mimeType || body.contentType || inferMimeType(body.fileName), size: buffer.length, buffer });
}

export async function saveEncryptedDocument(documentId, upload) {
    const storageFile = `${String(documentId).replace(/[^a-zA-Z0-9_-]/g, '_')}.cvault`;
    const storagePath = getSecureStoragePath(storageFile);
    await fs.mkdir(getSecureStorageDirectory(), { recursive: true });
    const encrypted = encryptBuffer(upload.buffer, env.documentStorageKey, { keyId: 'document-storage-v1' });
    await fs.writeFile(storagePath, encrypted.encryptedData, { mode: 0o600 });
    return {
        storageFile,
        storageNonce: encrypted.nonce.toString('base64'),
        storageTag: encrypted.tag.toString('base64'),
        storageKeyId: encrypted.keyId,
        storageAlgorithm: encrypted.algorithm,
        algorithm: HASH_ALGORITHM,
        hashAlgorithm: HASH_ALGORITHM,
        registeredHash: sha256Hash(upload.buffer),
        contentHash: sha256Hash(upload.buffer),
        size: upload.size,
        mimeType: upload.mimeType,
        extension: upload.extension,
    };
}

export async function readEncryptedDocument(document) {
    if (document.storageFile) {
        try {
            const encrypted = await fs.readFile(getSecureStoragePath(document.storageFile));
            return decryptBuffer({
                encryptedData: encrypted,
                nonce: Buffer.from(document.storageNonce || document.contentNonce || '', 'base64'),
                tag: Buffer.from(document.storageTag || document.contentTag || '', 'base64'),
            }, env.documentStorageKey);
        } catch {
            if (!document.encryptedContent) throw new Error('Stored document content is unavailable.');
        }
    }
    if (document.encryptedContent && document.contentNonce && document.contentTag) {
        return decryptBuffer({
            encryptedData: Buffer.from(document.encryptedContent, 'base64'),
            nonce: Buffer.from(document.contentNonce, 'base64'),
            tag: Buffer.from(document.contentTag, 'base64'),
        }, env.documentStorageKey);
    }
    if (document.seedContent) return Buffer.from(document.seedContent, 'utf8');
    throw new Error('Stored document content is unavailable.');
}

export async function removeEncryptedDocument(document) {
    if (!document.storageFile) return;
    await fs.rm(getSecureStoragePath(document.storageFile), { force: true });
}

export function toPublicDocument(document, shares = []) {
    const activeShares = shares.filter((share) => share.documentId === document.id && !share.revokedAt);
    return {
        id: document.id,
        fileName: document.fileName,
        caseId: document.caseId,
        caseNumber: document.caseNumber,
        category: document.category,
        classification: document.classification,
        version: document.version,
        versionOf: document.versionOf,
        rootDocumentId: document.rootDocumentId || document.versionOf || document.id,
        uploadedBy: document.uploadedBy,
        uploadedAt: document.uploadedAt,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        status: document.status,
        integrityStatus: document.integrityStatus,
        algorithm: document.algorithm || HASH_ALGORITHM,
        hashAlgorithm: document.hashAlgorithm || HASH_ALGORITHM,
        registeredHash: document.registeredHash,
        contentHash: document.contentHash || document.registeredHash,
        lastVerified: document.lastVerified,
        signatureAlgorithm: document.signatureAlgorithm,
        signatureStatus: document.signatureStatus,
        approvedBy: document.approvedBy,
        approvedAt: document.approvedAt,
        rejectionReason: document.rejectionReason,
        mimeType: document.mimeType,
        extension: document.extension,
        size: document.size,
        hasContent: true,
        shareCount: activeShares.length,
        downloadUrl: `/api/v1/documents/${encodeURIComponent(document.id)}/download`,
        previewUrl: `/api/v1/documents/${encodeURIComponent(document.id)}/preview`,
    };
}
