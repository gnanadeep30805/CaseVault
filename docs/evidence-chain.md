# Evidence chain

CaseVault supports a tamper-evident workflow for evidence movement and audit history.

## Chain features

- custody events contain previous and current hash values
- hash chain validation detects modified records
- audit chain validation confirms append-only logical integrity
- governing checks happen on the backend and are surfaced in the UI

## Status

The chain validation implementation is active and tested. It validates the hash sequence and flags suspicious events when records are altered.
