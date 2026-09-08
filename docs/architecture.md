# CaseVault architecture

CaseVault remains a React + Express application with a single security-first architecture layer.

## Components

- Frontend: React + Vite + existing design system
- API: Express app with route groups and middleware
- Security layer: JWT, MFA flow, access policy, integrity verification
- Data layer: in-memory seeded records plus future PostgreSQL/MinIO integration hooks
- Validation: backend test suite for cryptographic and integrity behaviors

## Security flow

User -> Auth -> MFA -> Zero Trust -> RBAC/ABAC -> resource access -> integrity checks -> audit trail

## Current implementation status

The project now includes real cryptographic primitives for AES-256-GCM, SHA3-256, HKDF-style derivation, Merkle tree validation, and chain verification logic. These components are implemented in the backend while preserving the existing UI theme and app flow.
