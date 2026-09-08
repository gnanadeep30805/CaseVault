<div align="center">
  
# 🔐 CaseVault

### Secure Digital Case, Evidence & Police Asset Lifecycle Management System

<p align="center">
  <strong>Secure. Track. Preserve. Verify.</strong><br/>
  A security-first digital platform for managing sensitive legal documents, investigation evidence, case workflows, and police assets.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20JavaScript-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Storage-MinIO%20%2F%20S3-C72E49?style=for-the-badge" alt="Object Storage"/>
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-111827?style=for-the-badge" alt="AES-256-GCM"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-JavaScript%20Only-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript Only"/>
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20MFA-7C3AED?style=for-the-badge" alt="JWT MFA"/>
  <img src="https://img.shields.io/badge/Search-OpenSearch-005EB8?style=for-the-badge" alt="OpenSearch"/>
  <img src="https://img.shields.io/badge/Blockchain-Hyperledger%20Fabric-2F3134?style=for-the-badge" alt="Hyperledger Fabric"/>
  <img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="License"/>
</p>
</div>
---

# 1. Project Overview

**CaseVault** is a secure digital document, case, evidence, and police asset lifecycle management platform designed for environments where confidentiality, integrity, traceability, and controlled collaboration are critical.

The platform provides a unified environment for:

- Digital case management
- Sensitive legal document management
- Evidence registration and chain-of-custody tracking
- Police asset lifecycle management
- Role-based and attribute-based access control
- Multi-factor authentication
- Encryption at rest and in transit
- Cryptographic integrity verification
- Tamper-evident audit trails
- Digital signatures
- Permissioned blockchain-based verification
- OCR-powered document search
- AI-assisted authorized document retrieval
- Notifications and workflow management
- Compliance-oriented retention and archival

The project is designed for an **SIH-style prototype**, while its architecture is structured so that it can evolve toward an enterprise-grade deployment.

> **Core principle:** Actual sensitive files are stored outside the blockchain. The blockchain stores verifiable proofs and transaction metadata.

---

# 2. Problem Statement

Law enforcement agencies, legal institutions, forensic departments, and investigative organizations handle large volumes of highly sensitive information.

Examples include:

- FIRs
- Investigation reports
- Statements
- Charge sheets
- Warrants
- Court orders
- Forensic reports
- Medical reports
- CCTV recordings
- Photographs
- Digital evidence
- Evidence transfer records
- Police asset records

Traditional document management approaches can create problems such as:

- Fragmented storage
- Unauthorized access
- Accidental modification
- Weak document provenance
- Missing audit history
- Manual evidence tracking
- Difficult cross-department collaboration
- Poor searchability
- Lack of cryptographic integrity verification
- Weak asset lifecycle visibility
- Difficulty proving whether a document was changed after approval

CaseVault addresses these problems through a centralized, security-first digital platform.

---

# 3. Objectives

### Primary Objectives

1. Digitize and centralize sensitive legal and investigation records.
2. Secure documents using authenticated encryption.
3. Restrict access using RBAC, ABAC, and Zero Trust principles.
4. Maintain complete, tamper-evident audit history.
5. Track evidence throughout its chain of custody.
6. Manage police assets from procurement to disposal.
7. Provide fast full-text and semantic document retrieval.
8. Preserve document and evidence integrity using cryptographic hashes.
9. Support digitally signed approvals and verification.
10. Enable controlled collaboration between authorized departments.
11. Provide AI-assisted retrieval without bypassing authorization.
12. Support verifiable cross-organization integrity records.

---

# 4. Solution

CaseVault separates **application data**, **encrypted files**, **search indexes**, and **integrity proofs**.

```text
                         CASEVAULT
                             │
             ┌───────────────┼────────────────┐
             │               │                │
        Application       Secure Files     Integrity
           Data             Storage          Layer
             │               │                │
       PostgreSQL        MinIO / S3      Hash Chain
             │               │           Merkle Tree
             │               │          Digital Signature
             │               │         Hyperledger Fabric
             │
        Search / AI
             │
       OpenSearch
             │
       OCR + RAG + LLM
```

This separation provides:

- Better security
- Better scalability
- Independent storage optimization
- Search performance
- Cryptographic verification
- Controlled AI access

---

# 5. Key Features

## 🔑 Authentication

- Username/password authentication
- Password hashing with Argon2id or bcrypt
- JWT-based session authorization
- Refresh-token rotation
- TOTP MFA
- Account lockout/rate limiting
- Session/device management

## 🛡️ Authorization

- RBAC
- ABAC
- Case-level authorization
- Department-level authorization
- Document classification
- Clearance-aware access
- Step-up authentication for sensitive actions

## 📁 Document Management

- Upload
- Download
- Preview
- Categorization
- Tags
- Versioning
- Sharing
- Approval
- Rejection
- Archiving
- Restoration
- Integrity verification

## ⚖️ Case Management

- Case creation
- Case assignment
- Case members
- Case status
- Case priority
- Case timeline
- Related documents
- Related evidence
- Related assets

## 🧪 Evidence Management

- Evidence registration
- Evidence classification
- Evidence hashing
- Custodian management
- Evidence transfer
- Chain of custody
- Integrity verification
- Digital signatures
- Evidence timeline

## 🚔 Police Asset Management

- Asset registration
- Asset assignment
- Asset transfer
- Maintenance tracking
- Warranty tracking
- Location tracking
- Condition tracking
- Asset history
- Retirement/disposal

## 🔍 Search

- Metadata search
- Full-text search
- OCR search
- Filters
- Case-aware search
- Permission-aware search
- Semantic search

## 🤖 AI

- Document summarization
- Case summaries
- Natural-language search
- Evidence Q&A
- RAG-based retrieval
- Citation/reference to source documents
- Authorization-aware retrieval

## 🧾 Audit

Every sensitive operation can generate an audit event:

```text
LOGIN
MFA_SUCCESS
CASE_CREATED
DOCUMENT_UPLOADED
DOCUMENT_VIEWED
DOCUMENT_DOWNLOADED
DOCUMENT_SHARED
DOCUMENT_VERSION_CREATED
DOCUMENT_APPROVED
DOCUMENT_REJECTED
EVIDENCE_REGISTERED
EVIDENCE_TRANSFERRED
ASSET_ASSIGNED
ASSET_TRANSFERRED
PERMISSION_CHANGED
INTEGRITY_VERIFIED
INTEGRITY_FAILED
```

---

# 6. Users and Roles

| Role | Main Responsibilities |
|---|---|
| System Administrator | System configuration and user administration |
| Investigating Officer | Cases, investigation documents, evidence |
| Senior Officer | Review, approval, assignment, supervision |
| Forensic Officer | Evidence examination and forensic reports |
| Legal Officer | Legal documents, review, court preparation |
| Auditor | Audit logs, integrity verification, compliance |
| Asset Manager | Police asset lifecycle |
| Department Manager | Department-level oversight |
| Court/Authorized External User | Restricted authorized access |

Roles should not be the only authorization mechanism.

CaseVault combines:

```text
Identity
   +
Role
   +
Department
   +
Case Membership
   +
Document Classification
   +
Clearance
   +
Action
   +
Context
```

---

# 7. Complete Module Architecture

```text
CaseVault
│
├── 01 Authentication & Identity
│   ├── Login
│   ├── MFA
│   ├── JWT
│   ├── Session Management
│   └── User Management
│
├── 02 Case Management
│   ├── Case Creation
│   ├── Case Assignment
│   ├── Case Members
│   ├── Case Timeline
│   └── Case Closure
│
├── 03 Document Management
│   ├── Upload
│   ├── Versioning
│   ├── Classification
│   ├── Sharing
│   ├── Approval
│   └── Archival
│
├── 04 Evidence Management
│   ├── Registration
│   ├── Collection
│   ├── Custody
│   ├── Transfer
│   ├── Examination
│   └── Verification
│
├── 05 Police Asset Management
│   ├── Registration
│   ├── Assignment
│   ├── Transfer
│   ├── Maintenance
│   ├── History
│   └── Disposal
│
├── 06 Audit & Integrity
│   ├── Audit Logs
│   ├── Hash Chain
│   ├── Merkle Tree
│   ├── Signatures
│   └── Verification
│
├── 07 Search
│   ├── Metadata Search
│   ├── Full Text
│   ├── OCR
│   └── Semantic Search
│
├── 08 AI Assistant
│   ├── RAG
│   ├── Summaries
│   ├── Case Q&A
│   └── Evidence Q&A
│
├── 09 Notifications
│   ├── Workflow Alerts
│   ├── Assignment Alerts
│   ├── Maintenance Alerts
│   └── Security Alerts
│
└── 10 Administration
    ├── Departments
    ├── Roles
    ├── Permissions
    ├── Policies
    └── System Configuration
```

---

# 8. Case Lifecycle

```text
                    ┌─────────────┐
                    │    CREATED  │
                    └──────┬──────┘
                           ↓
                 ┌──────────────────┐
                 │ UNDER INVESTIGATION│
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ EVIDENCE COLLECTION│
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ INVESTIGATION REVIEW│
                 └────────┬─────────┘
                          ↓
                    ┌────────────┐
                    │LEGAL REVIEW│
                    └─────┬──────┘
                          ↓
                    ┌──────────┐
                    │  CLOSED  │
                    └────┬─────┘
                         ↓
                    ┌──────────┐
                    │ ARCHIVED │
                    └──────────┘
```

A case should never be physically deleted by a normal user.

Use controlled lifecycle states and retention policies.

---

# 9. Document Lifecycle

```text
Upload
  ↓
Hash
  ↓
Encrypt
  ↓
Store
  ↓
Index
  ↓
Review
  ↓
Approve / Reject
  ↓
Version
  ↓
Archive
```

### Document classification

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
HIGHLY_RESTRICTED
```

Classification affects:

- Who can access the document
- Whether MFA is required
- Whether downloading is permitted
- Whether external sharing is allowed
- Retention policy
- Approval requirements
- Audit severity

### Versioning Rule

Never overwrite an existing approved document.

```text
Document
 ├── Version 1
 ├── Version 2
 ├── Version 3
 └── Version 4 (Current)
```

Each version stores its own:

- Hash
- Encryption metadata
- Created-by
- Created-at
- Version number
- Approval state
- Digital signature metadata

---

# 10. Evidence and Chain of Custody

Evidence is treated as a high-integrity entity.

### Evidence Metadata

```text
Evidence ID
Case ID
Evidence Type
Description
Collected By
Collection Date
Collection Location
Current Custodian
Storage Location
Status
Integrity Hash
Classification
Created At
Updated At
```

### Evidence Lifecycle

```text
COLLECTED
    ↓
REGISTERED
    ↓
VERIFIED
    ↓
STORED
    ↓
TRANSFERRED
    ↓
EXAMINED
    ↓
RETURNED / PRESENTED
    ↓
ARCHIVED
```

### Chain of Custody

Every transfer creates a permanent logical event:

```text
Officer A
   ↓
Forensic Officer
   ↓
Lab Custodian
   ↓
Legal Officer
   ↓
Court / Authorized Recipient
```

Each custody event contains:

```text
custody_id
evidence_id
from_user
to_user
reason
location
timestamp
previous_hash
current_hash
digital_signature
```

The application should reject unauthorized custody transitions.

---

# 11. Police Asset Lifecycle

The system also monitors and manages police assets throughout their lifecycle.

### Asset Categories

- Vehicles
- Weapons
- Communication devices
- Computers
- Body cameras
- CCTV equipment
- Protective equipment
- Forensic equipment
- Office equipment

### Asset Lifecycle

```text
PROCURED
   ↓
REGISTERED
   ↓
AVAILABLE
   ↓
ASSIGNED
   ↓
ACTIVE / IN USE
   ↓
MAINTENANCE
   ↓
REASSIGNED
   ↓
RETIRED
   ↓
DISPOSED
```

### Asset Information

```text
Asset ID
Asset Name
Category
Serial Number
Department
Assigned Officer
Purchase Date
Purchase Cost
Location
Condition
Status
Warranty
Last Maintenance
Next Maintenance
```

Every assignment, transfer, maintenance operation, and retirement is recorded.

---

# 12. Security Architecture

CaseVault uses defense in depth.

```text
                         SECURITY
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   Identity Security   Access Security    Data Security
        │                   │                   │
   JWT + MFA            RBAC + ABAC       AES-256-GCM
   Password Hashing     Zero Trust        TLS 1.3
   Rate Limiting        Case Policies     Envelope Encryption
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                    Integrity Security
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
          SHA3-256      Hash Chain     Merkle Tree
              │             │             │
              └─────────────┼─────────────┘
                            ↓
                   Digital Signatures
                            ↓
                 Permissioned Blockchain
```

## Cryptographic Components

| Purpose | Technology |
|---|---|
| File confidentiality | AES-256-GCM |
| File integrity | SHA3-256 |
| Audit tamper evidence | Hash Chain |
| Batch integrity | Merkle Tree |
| Digital authenticity | ECDSA P-256/P-384 or RSA-3072 |
| Key derivation | HKDF-SHA-256 |
| Internal authentication | HMAC-SHA-256 |
| Transport security | TLS 1.3 |
| Key protection | KMS / HSM / Vault |
| Strong authentication | TOTP MFA |

> These are the security technologies, not the complete application technology stack.

---

# 13. Complete Technology Stack

## JavaScript-Only Policy

> **No TypeScript is used anywhere in CaseVault.**

All application source code uses JavaScript. There are no `.ts` or `.tsx` files in the project architecture.

| Layer | Technology |
|---|---|
| Frontend | React.js + JavaScript |
| Build Tool | Vite |
| UI | Tailwind CSS |
| State Management | Redux Toolkit |
| Routing | React Router |
| HTTP Client | Axios |
| Backend | Node.js + Express.js |
| API | REST API |
| Database | PostgreSQL |
| ORM | Prisma ORM or Sequelize |
| Object Storage | MinIO / AWS S3 |
| Cache | Redis |
| Search | OpenSearch |
| OCR | Tesseract OCR |
| Authentication | JWT + TOTP MFA |
| Password Security | Argon2id / bcrypt |
| Authorization | RBAC + ABAC + Zero Trust |
| Encryption | AES-256-GCM |
| Hashing | SHA3-256 |
| Key Derivation | HKDF-SHA-256 |
| Internal Authentication | HMAC-SHA-256 |
| Signatures | ECDSA / RSA |
| Integrity | Hash Chain + Merkle Tree |
| Ledger | Hyperledger Fabric |
| Ordering | Raft |
| Key Management | HashiCorp Vault / Cloud KMS / HSM |
| AI | Google Gemini API / compatible LLM |
| RAG | LangChain.js |
| Vector Search | pgvector / OpenSearch |
| Messaging | RabbitMQ |
| Containers | Docker |
| Orchestration | Docker Compose / Kubernetes |
| Reverse Proxy | Nginx |
| Monitoring | Prometheus + Grafana |
| Logging | OpenSearch / ELK-compatible stack |
| CI/CD | GitHub Actions |

### SIH Prototype Stack

```text
React + JavaScript
        ↓
Node.js + Express.js
        ↓
PostgreSQL
        ↓
MinIO
        ↓
JWT + TOTP + RBAC + ABAC
        ↓
AES-256-GCM + SHA3-256
        ↓
Evidence + Chain of Custody
        ↓
Hash Chain + Merkle Tree
        ↓
Optional Hyperledger Fabric
        ↓
Optional OCR + Search + AI/RAG
```

---

# 14. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         USERS                                │
│ Officers │ Forensic │ Legal │ Auditor │ Asset Manager       │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             │ HTTPS / TLS 1.3
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                       NGINX                                  │
│ Reverse Proxy │ Rate Limiting │ Security Headers            │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                  REACT FRONTEND                              │
│ JavaScript │ Tailwind │ Redux │ Axios │ Protected Routes    │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST / JSON / Multipart
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                 NODE.JS + EXPRESS                            │
│                                                              │
│ Auth │ Cases │ Documents │ Evidence │ Assets │ Audit        │
│ Search │ Notifications │ AI │ Admin │ Integrity             │
└──────┬───────────────┬───────────────┬───────────────────────┘
       │               │               │
       ↓               ↓               ↓
┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐
│ PostgreSQL  │  │ MinIO / S3   │  │ Redis                  │
│ Metadata    │  │ Encrypted    │  │ Cache / Sessions /     │
│ Relations   │  │ Files        │  │ Rate Limiting          │
└─────────────┘  └──────────────┘  └────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│                    SEARCH LAYER                              │
│ OCR → OpenSearch → Vector Search                              │
└──────────────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│                  SECURITY ENGINE                             │
│ AES-GCM │ SHA3 │ HKDF │ Signatures │ Hash Chain │ Merkle    │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────┐
│               PERMISSIONED LEDGER                            │
│                 Hyperledger Fabric                           │
│       Police │ Forensic │ Legal │ Court/Authorized Org      │
└──────────────────────────────────────────────────────────────┘
```

---

# 15. End-to-End Data Flow

```text
User
 ↓
Login
 ↓
Password Verification
 ↓
JWT + MFA
 ↓
Request
 ↓
JWT Validation
 ↓
Zero Trust Context Evaluation
 ↓
RBAC Check
 ↓
ABAC Check
 ↓
Case-Level Permission Check
 ↓
Action
 ↓
Security Processing
 ↓
Database / Object Storage
 ↓
Audit Event
 ↓
Hash Chain
 ↓
Optional Merkle Root
 ↓
Optional Blockchain Anchor
 ↓
Response
```

No sensitive operation should bypass authorization or audit processing.

---

# 16. Document Upload and Protection Flow

```text
User selects file
        ↓
React multipart upload
        ↓
HTTPS / TLS 1.3
        ↓
Express API
        ↓
JWT validation
        ↓
MFA / step-up check if required
        ↓
RBAC
        ↓
ABAC
        ↓
Case authorization
        ↓
Validate MIME type / size
        ↓
Generate random DEK
        ↓
AES-256-GCM encryption
        ↓
Calculate SHA3-256 hash
        ↓
Store encrypted file in MinIO/S3
        ↓
Store metadata in PostgreSQL
        ↓
Index permitted metadata/text
        ↓
Create audit event
        ↓
Update hash chain
        ↓
Create Merkle root when batching
        ↓
Optional blockchain proof
```

### Encryption Model

Use envelope encryption:

```text
                 KMS / Vault / HSM
                        │
                     Master Key
                        │
                 Department KEK
                        │
                    Case Key
                        │
              Document DEK (random)
                        │
                        ↓
                 AES-256-GCM
                        │
                        ↓
                 Encrypted File
```

The plaintext document encryption key must not be stored directly in application source code or plaintext database fields.

---

# 17. Evidence Transfer Flow

```text
Officer A
   │
   │ Request Transfer
   ↓
Express API
   │
   ├── Authenticate
   ├── Authorize
   ├── Validate Evidence State
   ├── Validate Recipient
   └── Require MFA if policy demands
   │
   ↓
Create Custody Event
   │
   ├── Previous Hash
   ├── Current Hash
   ├── Actor
   ├── Recipient
   ├── Timestamp
   ├── Reason
   └── Digital Signature
   │
   ↓
PostgreSQL
   │
   ↓
Hash Chain
   │
   ↓
Optional Blockchain Anchor
   │
   ↓
Recipient accepts custody
```

---

# 18. Document Integrity Verification

The system supports a visible verification workflow.

```text
Current File
    ↓
SHA3-256
    ↓
Current Hash
    ↓
Compare with Registered Hash
    ↓
Compare with Ledger / Proof Hash
    ↓
Verify Digital Signature
    ↓
Verify Custody / Audit Chain
    ↓
RESULT
```

### Verified

```text
┌────────────────────────────────────┐
│       ✓ INTEGRITY VERIFIED        │
│                                    │
│ Hash: MATCH                        │
│ Signature: VALID                   │
│ Audit Chain: VALID                 │
│ Ledger Proof: VALID                │
└────────────────────────────────────┘
```

### Tampered

```text
┌────────────────────────────────────┐
│       ✕ INTEGRITY FAILED          │
│                                    │
│ Hash: MISMATCH                     │
│ Signature: INVALID                 │
│ Ledger Proof: MISMATCH             │
└────────────────────────────────────┘
```

This is one of the strongest SIH demonstration features.

---

# 19. Blockchain Architecture

Blockchain is used selectively for **cross-organization integrity and provenance**, not as the main database or file store.

### Permissioned Organizations

```text
             Hyperledger Fabric
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   Police Org    Forensic Org   Legal Org
       │             │             │
       └─────────────┼─────────────┘
                     ↓
              Court / Auditor
```

### Consensus

For a trusted permissioned consortium, Hyperledger Fabric's Raft-based ordering is an appropriate prototype choice.

PBFT-style Byzantine fault-tolerant approaches can be considered for environments with stronger adversarial assumptions.

### Store on Blockchain

```text
document_id
case_id
evidence_id
document_hash
merkle_root
timestamp
actor_id
action
signature
previous_proof_hash
```

### Never Store on Blockchain

```text
PDF files
Images
Videos
CCTV files
Raw personal data
Large evidence files
Full document contents
Passwords
Encryption keys
```

Actual files remain in encrypted object storage.

---

# 20. AI and RAG Architecture

AI must never become an authorization bypass.

### Secure AI Pipeline

```text
User
 ↓
Authentication
 ↓
Authorization
 ↓
Identify accessible cases
 ↓
Identify accessible documents
 ↓
Retrieve only authorized chunks
 ↓
Vector Search
 ↓
Reranking
 ↓
Context Filtering
 ↓
LLM
 ↓
Answer + Source References
```

### Document Ingestion

```text
Document
 ↓
Decrypt only inside authorized processing boundary
 ↓
OCR if scanned
 ↓
Text Extraction
 ↓
Chunking
 ↓
Embedding
 ↓
Vector Index
```

### AI Capabilities

- Case summarization
- Document summarization
- Natural-language search
- Evidence Q&A
- Investigation timeline generation
- Related-document discovery

> The AI layer receives only documents the authenticated user is already authorized to access.

---

# 21. Authorization Architecture

## RBAC

Example roles:

```text
INVESTIGATING_OFFICER
FORENSIC_OFFICER
LEGAL_OFFICER
AUDITOR
ADMIN
ASSET_MANAGER
```

RBAC answers:

> What can this role generally do?

## ABAC

Attributes can include:

```text
user.department
user.clearanceLevel
case.department
case.classification
document.classification
action
location
time
deviceTrust
mfaLevel
```

ABAC answers:

> Is this user allowed to perform this action in this context?

### Example Policy

```text
ALLOW DOWNLOAD
IF
user.role = INVESTIGATING_OFFICER
AND user.department = case.department
AND user is case member
AND document.classification <= user.clearance
AND MFA is satisfied
```

### Zero Trust

Every sensitive request is independently evaluated.

```text
Never trust
Always verify
Least privilege
Continuous evaluation
```

---

# 22. Database Architecture

PostgreSQL stores **metadata and relationships**, not large binary files.

```text
                    PostgreSQL
                         │
       ┌─────────────────┼──────────────────┐
       ↓                 ↓                  ↓
      Users             Cases              Assets
       │                 │                  │
       ↓                 ↓                  ↓
     Roles          Documents          Assignments
       │                 │                  │
       ↓                 ↓                  ↓
 Permissions       Versions           Maintenance
                         │
                         ↓
                      Evidence
                         │
                         ↓
                    Custody Chain
                         │
                         ↓
                     Audit Logs
```

### Object Storage

```text
PostgreSQL
    │
    └── object_key
            │
            ↓
       MinIO / S3
            │
       encrypted file
```

---

# 23. Database Schema

## users

```text
id
employee_id
name
email
password_hash
department_id
role_id
clearance_level
mfa_enabled
status
created_at
updated_at
```

## roles

```text
id
name
description
```

## permissions

```text
id
name
description
```

## role_permissions

```text
role_id
permission_id
```

## departments

```text
id
name
code
description
```

## cases

```text
id
case_number
title
description
case_type
classification
priority
status
department_id
created_by
assigned_officer
created_at
updated_at
closed_at
```

## case_members

```text
id
case_id
user_id
role
joined_at
```

## documents

```text
id
case_id
document_number
title
category
classification
current_version_id
storage_key
mime_type
size
document_hash
status
created_by
created_at
updated_at
```

## document_versions

```text
id
document_id
version_number
storage_key
document_hash
encrypted_dek
iv
auth_tag
created_by
created_at
approved_by
approved_at
status
```

## document_permissions

```text
id
document_id
user_id
permission
expires_at
created_by
```

## evidence

```text
id
evidence_number
case_id
type
description
classification
collected_by
collection_location
collection_time
current_custodian
storage_location
status
integrity_hash
created_at
updated_at
```

## evidence_custody

```text
id
evidence_id
from_user
to_user
action
reason
location
previous_hash
current_hash
digital_signature
timestamp
```

## assets

```text
id
asset_number
name
category
serial_number
department_id
location
condition
status
purchase_date
purchase_cost
warranty_end
last_maintenance
next_maintenance
created_at
updated_at
```

## asset_assignments

```text
id
asset_id
assigned_to
assigned_by
assigned_at
returned_at
location
reason
```

## asset_maintenance

```text
id
asset_id
maintenance_type
description
performed_by
cost
performed_at
next_due
status
```

## asset_history

```text
id
asset_id
action
actor_id
old_value
new_value
timestamp
```

## audit_logs

```text
id
actor_id
action
resource_type
resource_id
ip_address
user_agent
metadata
previous_hash
event_hash
created_at
```

## notifications

```text
id
user_id
type
title
message
severity
is_read
created_at
```

---

# 24. API Architecture

All APIs use:

```text
/api/v1/*
```

Example:

```text
/api/v1/auth/login
/api/v1/cases
/api/v1/documents
/api/v1/evidence
/api/v1/assets
```

### Standard Response

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {},
  "requestId": "..."
}
```

### Standard Error

```json
{
  "success": false,
  "message": "Access denied",
  "code": "FORBIDDEN",
  "requestId": "..."
}
```

---

# 25. API Endpoints

## Authentication

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/verify-mfa
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/mfa/setup
POST   /api/v1/auth/mfa/verify
GET    /api/v1/auth/me
```

## Users

```text
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PUT    /api/v1/users/:id
PATCH  /api/v1/users/:id/status
```

## Cases

```text
GET    /api/v1/cases
POST   /api/v1/cases
GET    /api/v1/cases/:id
PUT    /api/v1/cases/:id
PATCH  /api/v1/cases/:id/status
POST   /api/v1/cases/:id/members
DELETE /api/v1/cases/:id/members/:userId
GET    /api/v1/cases/:id/timeline
```

## Documents

```text
GET    /api/v1/documents
POST   /api/v1/documents/upload
GET    /api/v1/documents/:id
GET    /api/v1/documents/:id/download
GET    /api/v1/documents/:id/versions
POST   /api/v1/documents/:id/versions
POST   /api/v1/documents/:id/share
POST   /api/v1/documents/:id/approve
POST   /api/v1/documents/:id/reject
POST   /api/v1/documents/:id/archive
POST   /api/v1/documents/:id/verify
```

## Evidence

```text
GET    /api/v1/evidence
POST   /api/v1/evidence
GET    /api/v1/evidence/:id
PUT    /api/v1/evidence/:id
POST   /api/v1/evidence/:id/transfer
GET    /api/v1/evidence/:id/custody
POST   /api/v1/evidence/:id/verify
```

## Assets

```text
GET    /api/v1/assets
POST   /api/v1/assets
GET    /api/v1/assets/:id
PUT    /api/v1/assets/:id
POST   /api/v1/assets/:id/assign
POST   /api/v1/assets/:id/return
POST   /api/v1/assets/:id/maintenance
GET    /api/v1/assets/:id/history
PATCH  /api/v1/assets/:id/status
```

## Audit

```text
GET    /api/v1/audit
GET    /api/v1/audit/:id
GET    /api/v1/audit/resource/:resourceType/:resourceId
POST   /api/v1/audit/verify-chain
```

## Search

```text
GET /api/v1/search
GET /api/v1/search/documents
GET /api/v1/search/evidence
GET /api/v1/search/cases
```

## AI

```text
POST /api/v1/ai/query
POST /api/v1/ai/summarize/case/:id
POST /api/v1/ai/summarize/document/:id
```

---

# 26. Backend Architecture

Backend technology:

```text
Node.js
Express.js
JavaScript
PostgreSQL
Prisma / Sequelize
Redis
MinIO SDK
JWT
Argon2id / bcrypt
```

### Backend Layers

```text
HTTP Request
     ↓
Routes
     ↓
Middleware
     ├── Helmet
     ├── CORS
     ├── Rate Limit
     ├── Request ID
     ├── JWT
     └── Validation
     ↓
Controllers
     ↓
Services
     ↓
Repositories / ORM
     ↓
Database / Storage
```

Business logic belongs in services, while controllers remain thin and focused on HTTP concerns.

---

# 27. Frontend Architecture

Frontend:

```text
React.js
JavaScript
Vite
Tailwind CSS
Redux Toolkit
React Router
Axios
Recharts
```

### Main Screens

```text
Login
MFA Verification
Dashboard
Cases
Case Details
Documents
Document Details
Evidence
Evidence Details
Chain of Custody
Assets
Asset Details
Audit Logs
Search
AI Assistant
Notifications
User Management
Settings
```

### Dashboard

Show:

```text
Active Cases
Pending Reviews
Evidence Items
Custody Transfers
Documents
Integrity Alerts
Assets
Maintenance Due
Security Alerts
```

---

# 28. Repository Structure

```text
casevault/
│
├── README.md
├── LICENSE
├── .gitignore
├── docker-compose.yml
├── .env.example
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── assets/
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── cases/
│       │   ├── documents/
│       │   ├── evidence/
│       │   ├── assets/
│       │   ├── audit/
│       │   └── security/
│       │
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── MFAVerification.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Cases.jsx
│       │   ├── CaseDetails.jsx
│       │   ├── Documents.jsx
│       │   ├── Evidence.jsx
│       │   ├── ChainOfCustody.jsx
│       │   ├── Assets.jsx
│       │   ├── AuditLogs.jsx
│       │   ├── Search.jsx
│       │   └── AIAssistant.jsx
│       │
│       ├── services/
│       │   ├── api.js
│       │   ├── authApi.js
│       │   ├── caseApi.js
│       │   ├── documentApi.js
│       │   ├── evidenceApi.js
│       │   ├── assetApi.js
│       │   ├── auditApi.js
│       │   └── aiApi.js
│       │
│       ├── store/
│       │   ├── store.js
│       │   └── slices/
│       │
│       ├── hooks/
│       ├── utils/
│       ├── routes/
│       ├── App.jsx
│       └── main.jsx
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   │
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── database.js
│   │   │   ├── redis.js
│   │   │   ├── storage.js
│   │   │   └── logger.js
│   │   │
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── security/
│   │   ├── crypto/
│   │   ├── storage/
│   │   ├── search/
│   │   ├── ai/
│   │   ├── blockchain/
│   │   └── utils/
│   │
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
├── blockchain/
│   ├── network/
│   ├── chaincode/
│   └── scripts/
│
├── infrastructure/
│   ├── nginx/
│   ├── docker/
│   ├── prometheus/
│   └── grafana/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── security/
│   └── diagrams/
│
└── tests/
    ├── unit/
    ├── integration/
    ├── security/
    └── e2e/
```

> All application source files use `.js` or `.jsx`. No `.ts` or `.tsx` files are permitted.

---

# 29. UI/UX Design System

CaseVault should visually communicate **trust, security, authority, and clarity**.

### Design Direction

- Professional
- Minimal
- Enterprise
- Security-focused
- Information-dense but readable
- Responsive
- Accessible

### Recommended Theme

Use a restrained dark/light enterprise interface.

```text
Primary:
Deep Navy / Slate

Accent:
Indigo / Blue

Success:
Green

Warning:
Amber

Critical:
Red

Neutral:
Slate / Gray
```

Avoid excessive gradients and unnecessary decorative elements.

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ Top Bar: Search | Notifications | Profile                │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│ Sidebar      │             Main Content                  │
│              │                                           │
│ Dashboard    │  Cards / Tables / Timelines / Forms      │
│ Cases        │                                           │
│ Documents    │                                           │
│ Evidence     │                                           │
│ Assets       │                                           │
│ Audit        │                                           │
│ Search       │                                           │
│ AI Assistant │                                           │
│ Settings     │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### Security Indicators

Every sensitive object should visibly show:

```text
Classification
Access Status
Integrity Status
Last Modified
Last Verified
```

---

# 30. Notifications

Notification categories:

### Case

- New case assignment
- Case status change
- Review required
- Case approaching deadline

### Evidence

- Evidence transfer request
- Custody acceptance
- Custody rejection
- Integrity failure

### Documents

- Document shared
- Approval requested
- Document approved
- Document rejected

### Assets

- Maintenance due
- Warranty expiry
- Asset assigned
- Asset transfer

### Security

- Failed login
- MFA failure
- Suspicious activity
- Unauthorized access attempt
- Integrity verification failure

---

# 31. Audit and Compliance

Audit logging is a first-class subsystem.

### Audit Record

```text
Actor
Action
Resource
Resource ID
Timestamp
IP Address
User Agent
Request ID
Metadata
Previous Event Hash
Current Event Hash
```

### Hash-Chain Design

```text
Event 1
Hash(E1)
   ↓
Event 2 + Hash(E1)
Hash(E2)
   ↓
Event 3 + Hash(E2)
Hash(E3)
   ↓
Event 4 + Hash(E3)
Hash(E4)
```

If an old audit event is modified, subsequent verification can detect the break.

### Audit Requirements

Audit:

- Authentication
- Authorization failures
- Document access
- Downloads
- Sharing
- Version creation
- Approvals
- Evidence transfers
- Asset assignments
- Permission changes
- Integrity verification
- Administrative changes

---

# 32. Threat Model

| Threat | Protection |
|---|---|
| Stolen password | MFA |
| Brute-force login | Rate limiting + lockout |
| Unauthorized API access | JWT + authorization |
| Privilege escalation | RBAC + ABAC |
| Stolen database | Encrypted sensitive fields + hashes |
| Stolen files | AES-256-GCM |
| File modification | SHA3-256 |
| Audit manipulation | Hash chain |
| Batch tampering | Merkle tree |
| Forged approval | Digital signature |
| Cross-org dispute | Permissioned ledger proof |
| Session theft | Short-lived access token + rotation |
| Malicious upload | MIME validation + size limits + malware scanning |
| SQL injection | Parameterized queries / ORM |
| XSS | Output encoding + CSP |
| CSRF | SameSite cookies / CSRF controls where applicable |
| API abuse | Rate limiting |
| Insider misuse | Least privilege + audit |
| AI data leakage | Authorization-filtered RAG |
| Key compromise | KMS/HSM/Vault |
| Network interception | TLS 1.3 |

---

# 33. Performance and Scalability

### Storage Scalability

Use object storage for large files.

```text
PostgreSQL → metadata
MinIO/S3 → files
```

This prevents database bloat.

### Caching

Redis can cache:

- User permissions
- Frequently accessed case metadata
- Dashboard metrics
- Session information
- Rate-limit counters

Never cache sensitive data without a clear security policy.

### Asynchronous Processing

Use RabbitMQ for:

```text
Document OCR
Search indexing
Embedding generation
Notifications
Audit anchoring
Large file processing
AI ingestion
```

### Horizontal Scaling

```text
                  Load Balancer
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       API-1         API-2        API-3
          │            │            │
          └────────────┼────────────┘
                       ↓
                  PostgreSQL
                       │
                  MinIO / S3
```

The Express API should remain stateless wherever practical.

---

# 34. Deployment Architecture

## Development

```text
Developer Machine
      │
      └── Docker Compose
            ├── Frontend
            ├── Backend
            ├── PostgreSQL
            ├── Redis
            ├── MinIO
            └── OpenSearch
```

## Production Target

```text
                    Internet / Private Network
                              │
                           WAF/LB
                              │
                            Nginx
                              │
                   ┌──────────┴──────────┐
                   │                     │
                Frontend              API Cluster
                                        │
                           ┌────────────┼────────────┐
                           ↓            ↓            ↓
                       PostgreSQL     Redis       RabbitMQ
                           │
                     MinIO / S3
                           │
                      OpenSearch
                           │
                    Security Services
                           │
                    Hyperledger Fabric
```

---

# 35. Environment Configuration

Use `.env.example`.

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=postgresql://casevault:password@postgres:5432/casevault

JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me

JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

REDIS_URL=redis://redis:6379

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=change_me
MINIO_SECRET_KEY=change_me
MINIO_BUCKET=casevault

OPENSEARCH_URL=http://opensearch:9200

RABBITMQ_URL=amqp://rabbitmq:5672

GEMINI_API_KEY=change_me

VAULT_ADDR=http://vault:8200
VAULT_TOKEN=change_me
```

### Never Commit

```text
.env
private keys
JWT secrets
KMS credentials
Vault tokens
API keys
production certificates
user passwords
```

---

# 36. Local Development

## Prerequisites

Install:

```text
Node.js LTS
npm
Docker
Docker Compose
Git
```

Optional:

```text
VS Code
Postman / Bruno
DBeaver
```

## Clone

```bash
git clone https://github.com/gnanadeep30805/CaseVault.git
cd CaseVault
```

## Install Frontend

```bash
cd frontend
npm install
npm run dev
```

## Install Backend

```bash
cd backend
npm install
npm run dev
```

## Start Infrastructure

From the root:

```bash
docker compose up -d
```

## Stop Infrastructure

```bash
docker compose down
```

## Production Build

```bash
npm run build
```

---

# 37. Docker Architecture

Example services:

```yaml
services:

  frontend:
    build: ./frontend

  backend:
    build: ./backend

  postgres:
    image: postgres

  redis:
    image: redis

  minio:
    image: minio/minio

  opensearch:
    image: opensearchproject/opensearch

  rabbitmq:
    image: rabbitmq

  nginx:
    image: nginx
```

For the SIH prototype, start with:

```text
frontend
backend
postgres
minio
redis
```

Then add:

```text
opensearch
rabbitmq
fabric
```

only when the corresponding feature is implemented.

---

# 38. Testing Strategy

## Unit Testing

Test:

- AES encryption/decryption
- SHA3 hashing
- HKDF
- Hash chain
- Merkle tree
- Authorization policies
- Case state transitions
- Evidence state transitions
- Asset state transitions

## Integration Testing

Test:

```text
API → Service → PostgreSQL
API → MinIO
API → Redis
API → Search
API → Blockchain
```

## Security Testing

Test:

- Invalid JWT
- Expired JWT
- Invalid MFA
- Unauthorized role
- Unauthorized case access
- Unauthorized document download
- Path traversal
- Malicious file upload
- SQL injection
- XSS
- Rate-limit behavior
- Permission escalation

## E2E Testing

Example:

```text
Login
 ↓
MFA
 ↓
Create Case
 ↓
Upload Document
 ↓
Encrypt
 ↓
Hash
 ↓
Approve
 ↓
Register Evidence
 ↓
Transfer Evidence
 ↓
Verify Integrity
 ↓
View Audit Trail
```

---

# 39. CI/CD

Recommended GitHub Actions pipeline:

```text
Git Push
   ↓
Lint
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Security Scan
   ↓
Build Frontend
   ↓
Build Backend
   ↓
Build Docker Images
   ↓
Deploy to Environment
```

Suggested checks:

```text
npm audit
ESLint
Jest
Supertest
Playwright
Container scanning
Secret scanning
Dependency scanning
```

---

# 40. Monitoring and Observability

Monitor:

### Application

- Request rate
- Response time
- Error rate
- Active sessions
- Upload failures

### Security

- Failed logins
- MFA failures
- Authorization failures
- Integrity failures
- Suspicious access

### Infrastructure

- CPU
- Memory
- Disk
- Database connections
- Object storage usage
- Redis health
- OpenSearch health

### Tools

```text
Prometheus
Grafana
Pino
OpenSearch
```

Every API request should have a correlation/request ID.

---

# 41. SIH Prototype Scope

The full architecture contains many enterprise capabilities. The SIH prototype should prioritize features that clearly demonstrate the problem and innovation.

## 🔴 Must Implement

```text
React + JavaScript
Node.js + Express
PostgreSQL
MinIO
JWT
TOTP MFA
RBAC
ABAC
Case Management
Document Management
Document Versioning
AES-256-GCM
SHA3-256
Evidence Management
Chain of Custody
Police Asset Lifecycle
Audit Logs
Hash Chain
Integrity Verification
```

## 🟡 Strong Differentiators

```text
Digital Signatures
Merkle Tree
OCR
OpenSearch
Advanced filtering
Permission-aware search
Security dashboard
Step-up MFA
```

## 🟢 Advanced / Optional

```text
Hyperledger Fabric
Raft ordering
KMS/HSM
RabbitMQ
AI/RAG
Vector search
Cross-organization verification
Kubernetes
```

### Important SIH Strategy

Do not implement every technology merely to increase the technology count.

A smaller number of correctly implemented security mechanisms is stronger than many partially implemented technologies.

---

# 42. SIH Demonstration Scenario

Use one complete story to demonstrate CaseVault.

## Scenario: Investigation of a Theft Case

### Step 1 — Login

Investigating Officer:

```text
Username
Password
TOTP
```

The system authenticates the officer.

### Step 2 — Create Case

```text
Case ID: CV-2026-001
Type: Theft
Classification: RESTRICTED
Status: UNDER_INVESTIGATION
```

### Step 3 — Upload FIR

The officer uploads an FIR.

System automatically:

```text
Validate file
 ↓
Generate document hash
 ↓
Encrypt with AES-256-GCM
 ↓
Store in MinIO
 ↓
Store metadata in PostgreSQL
 ↓
Create audit event
```

### Step 4 — Upload CCTV Evidence

CCTV file is registered as evidence.

```text
Evidence ID: EV-001
Case: CV-2026-001
Custodian: Investigating Officer
```

### Step 5 — Transfer Evidence

Officer transfers EV-001 to the forensic department.

System records:

```text
From: Investigating Officer
To: Forensic Officer
Reason: Forensic Examination
Timestamp
Hash
Digital Signature
```

### Step 6 — Forensic Report

Forensic officer uploads report.

The report becomes a new document version/entity and is linked to the evidence.

### Step 7 — Supervisor Approval

Supervisor reviews and digitally approves the report.

### Step 8 — Auditor

Auditor opens the audit timeline.

```text
Case Created
   ↓
FIR Uploaded
   ↓
CCTV Registered
   ↓
Evidence Transferred
   ↓
Forensic Report Uploaded
   ↓
Report Approved
```

### Step 9 — Tampering Demonstration

For SIH demonstration, use a controlled test copy.

Change the underlying test file.

Click:

```text
VERIFY INTEGRITY
```

System calculates:

```text
Current SHA3-256
        ≠
Registered SHA3-256
```

Then displays:

```text
✕ TAMPERING DETECTED

Hash: MISMATCH
Signature: INVALID
Ledger Proof: MISMATCH
```

This gives the judges a concrete demonstration of why CaseVault is different from a normal document management system.

---

# 43. Implementation Roadmap

## Phase 1 — Foundation

```text
Initialize monorepo
Setup React
Setup Express
Setup PostgreSQL
Setup Docker
Setup environment configuration
Setup logging
Setup API structure
```

## Phase 2 — Authentication

```text
Users
Roles
Passwords
JWT
Refresh Tokens
MFA
Security Middleware
```

## Phase 3 — Case Management

```text
Cases
Case Members
Assignments
Status
Timeline
```

## Phase 4 — Document Management

```text
Upload
MinIO
Metadata
Versioning
Classification
Permissions
Download
Approval
```

## Phase 5 — Cryptographic Security

```text
AES-256-GCM
SHA3-256
HKDF
Key hierarchy
Digital signatures
```

## Phase 6 — Evidence

```text
Evidence
Custody
Transfers
Integrity verification
Evidence timeline
```

## Phase 7 — Asset Management

```text
Assets
Assignments
Maintenance
Transfers
History
Lifecycle
```

## Phase 8 — Audit

```text
Audit events
Hash chain
Merkle tree
Verification UI
```

## Phase 9 — Search

```text
Metadata search
OCR
OpenSearch
Filters
```

## Phase 10 — AI

```text
Embeddings
Vector search
RAG
Gemini / LLM
Permission-aware retrieval
```

## Phase 11 — Blockchain

```text
Fabric network
Organizations
Chaincode
Ledger proofs
Verification
```

## Phase 12 — Hardening

```text
Security testing
Performance testing
Docker deployment
Monitoring
Documentation
SIH demo preparation
```

---

# 44. Future Enhancements

Potential future capabilities:

- Mobile application for field officers
- Offline evidence collection with secure synchronization
- Hardware-backed device identity
- Biometric authentication
- Digital forensic acquisition integration
- Advanced DLP
- Automated malware scanning
- Immutable archival storage
- Geographic evidence mapping
- Advanced anomaly detection
- AI-assisted investigation timelines
- Automated case relationship discovery
- Multi-region disaster recovery
- Hardware security module integration
- Post-quantum cryptography migration
- Cross-state/cross-agency interoperability

---

# 45. Engineering Principles

## 1. Security by Design

Security must be part of the architecture rather than an afterthought.

## 2. Least Privilege

Users receive only the access required for their responsibilities.

## 3. Never Trust Client Authorization

Frontend controls are for UX only.

The backend must enforce authorization.

## 4. Never Store Sensitive Files in PostgreSQL

Store metadata in PostgreSQL and encrypted binary content in object storage.

## 5. Never Store Encryption Keys in Source Code

Use KMS, HSM, Vault, or secure secret management.

## 6. Never Overwrite Approved Documents

Use immutable version records.

## 7. Audit Sensitive Actions

Every important action should be traceable.

## 8. AI Must Respect Authorization

The AI system must never retrieve a document the user cannot access directly.

## 9. Blockchain Is Not Primary Storage

Use the ledger for proofs, provenance, and cross-organization verification.

## 10. Prefer Implemented Security Over Buzzwords

Every technology in the architecture should have a clear purpose.

---

# 46. Conclusion

**CaseVault** combines secure digital document management with investigation case management, evidence chain of custody, police asset lifecycle tracking, cryptographic integrity verification, controlled collaboration, auditability, and AI-assisted retrieval.

The architecture deliberately separates:

```text
Application Data
      ↓
PostgreSQL

Encrypted Files
      ↓
MinIO / S3

Search
      ↓
OpenSearch

AI Retrieval
      ↓
RAG + LLM

Integrity
      ↓
SHA3-256
Hash Chain
Merkle Tree
Digital Signatures

Cross-Organization Verification
      ↓
Hyperledger Fabric
```

The resulting system is not simply a document storage application.

It is a:

> **Secure Digital Case, Evidence & Police Asset Lifecycle Management Platform with Cryptographic Integrity, Tamper-Evident Auditing, Controlled Collaboration, and Authorization-Aware AI.**

### Final Architecture

```text
                         ┌─────────────────────┐
                         │       USERS         │
                         └──────────┬──────────┘
                                    ↓
                         ┌─────────────────────┐
                         │   React + JavaScript│
                         └──────────┬──────────┘
                                    ↓
                              HTTPS / TLS 1.3
                                    ↓
                         ┌─────────────────────┐
                         │        NGINX        │
                         └──────────┬──────────┘
                                    ↓
                    ┌───────────────────────────────┐
                    │   Node.js + Express + JS      │
                    │                               │
                    │ Auth | Cases | Documents     │
                    │ Evidence | Assets | Audit    │
                    │ Search | AI | Administration  │
                    └───────────────┬───────────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              ↓                     ↓                      ↓
       ┌──────────────┐      ┌──────────────┐       ┌──────────┐
       │ PostgreSQL   │      │ MinIO / S3   │       │  Redis   │
       │ Metadata     │      │ Encrypted    │       │  Cache   │
       │ Relationships│      │ Documents    │       │          │
       └──────────────┘      └──────────────┘       └──────────┘
              │                     │
              └──────────┬──────────┘
                         ↓
               ┌─────────────────────┐
               │ Security Engine     │
               │                     │
               │ AES-256-GCM         │
               │ SHA3-256            │
               │ HKDF                │
               │ Digital Signatures  │
               │ Hash Chain          │
               │ Merkle Tree         │
               └──────────┬──────────┘
                          ↓
               ┌─────────────────────┐
               │ Search / OCR / RAG  │
               │                     │
               │ OpenSearch          │
               │ Tesseract           │
               │ Vector Search       │
               │ LLM                 │
               └──────────┬──────────┘
                          ↓
               ┌─────────────────────┐
               │ Permissioned Ledger │
               │                     │
               │ Hyperledger Fabric  │
               │ Raft Ordering       │
               └─────────────────────┘
```

---

## 📌 Project Identity

**Project:** CaseVault  
**Category:** Secure Digital Document & Investigation Management  
**Primary Use Case:** Law Enforcement / Legal / Investigation Departments  
**Frontend:** React.js + JavaScript  
**Backend:** Node.js + Express.js + JavaScript  
**Database:** PostgreSQL  
**File Storage:** MinIO / S3  
**Security:** AES-256-GCM + SHA3-256 + JWT + MFA + RBAC + ABAC + Zero Trust  
**Integrity:** Hash Chain + Merkle Tree + Digital Signatures  
**Ledger:** Hyperledger Fabric  
**Search:** OpenSearch + OCR  
**AI:** RAG + LLM  
**Deployment:** Docker / Docker Compose  
**Language Policy:** **JavaScript only — no TypeScript anywhere**

---

<p align="center">
  <strong>CaseVault — Secure. Track. Preserve. Verify.</strong>
</p>
