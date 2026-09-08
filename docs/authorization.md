# Authorization model

CaseVault keeps security evaluation server-side and denies unauthorized access before data retrieval.

## Rules

- authentication required for protected routes
- role checks enforced in middleware
- zero-trust checks include department, clearance, MFA, device trust, and request risk
- sensitive actions require explicit authorization and verification

## Current implementation

This repository implements the access-control skeleton and policy evaluation layer, and exposes it for extension to case, document, evidence, and admin actions.
