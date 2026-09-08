# Cryptography

## Implemented primitives

- AES-256-GCM encryption for payloads
- SHA3-256 hashing
- HKDF-style key derivation helper
- Merkle tree generation and proof verification
- Audit and custody chain validation
- Zero-Trust policy evaluation

## Design

Key generation is abstracted in the backend security service so production deployments can swap development secrets for Vault/KMS/HSM-managed keys without exposing keys in the frontend or database.

## Important rules

- unique IV/nonce per encryption operation
- secrets never placed in frontend code
- no raw key storage in application data
- integrity checks performed on the server
