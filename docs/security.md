# Security model

## Authentication

- JWT bearer access tokens
- MFA flow using a verification step in the auth service and UI
- Role-based checks in the API middleware

## Authorization

- Centralized access policy evaluation in the security service
- Department and clearance-aware access rules
- Server-side validation required before sensitive actions

## Integrity

- Document and evidence verification endpoints
- Hash chain validation
- Custody chain validation
- Merkle proof validation and tamper detection

## Production readiness

The current implementation is a development-safe working prototype. It is designed to be replaced by Vault/KMS/HSM-backed key management in production without altering the application layer.
