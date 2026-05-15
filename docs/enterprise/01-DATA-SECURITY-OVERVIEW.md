# Evident — Data Security Overview

**Version:** 1.0 | **Date:** March 2026 | **Classification:** Client-Facing

---

## 1. Executive Summary

Evident is built with a security-first architecture designed for enterprise environments. This document outlines how we protect your data across storage, processing, transmission, and access — giving your organisation full confidence in adopting Evident as your AI document assistant.

---

## 2. Data Architecture

### 2.1 What Data We Process

| Data Type | Description | Storage Location |
|-----------|-------------|-----------------|
| Documents | Uploaded files (PDF, Word, Excel, images, audio, video) | Object Storage (encrypted) |
| Embeddings | AI-generated vector representations of document content | PostgreSQL with pgvector |
| Metadata | File names, sizes, upload dates, document scores | PostgreSQL |
| Chat History | User queries and AI responses | PostgreSQL |
| User Accounts | Email, authentication tokens, preferences | PostgreSQL |
| Usage Metrics | Query counts, feature usage (anonymised) | PostgreSQL |

### 2.2 What We Do NOT Store

- Passwords in plain text (hashed using industry-standard algorithms)
- Payment card details (handled entirely by Stripe, PCI DSS compliant)
- Raw API keys from third-party integrations in application code

---

## 3. Data Encryption

### 3.1 Data in Transit
- All client-to-server communication uses **TLS 1.2+** (HTTPS enforced)
- API calls to third-party services (OpenAI, Stripe) use TLS encryption
- Internal service-to-service communication is encrypted

### 3.2 Data at Rest
- All stored data is encrypted using **AES-256** encryption via Google Cloud Platform's default encryption
- Database backups are encrypted
- Object storage files are encrypted at the storage layer

### 3.3 Encryption Key Management
- Encryption keys are managed by Google Cloud's Key Management Service (KMS)
- Keys are automatically rotated on a regular schedule
- **Private Cloud & On-Premise tiers:** Clients can use their own encryption keys (Customer-Managed Encryption Keys / CMEK)

---

## 4. Data Residency & Storage Options

Evident offers flexible data residency to meet your regulatory requirements:

| Deployment Option | Data Location | Control Level |
|------------------|---------------|---------------|
| **Evident Cloud** | Google Cloud (multi-region) | Evident-managed |
| **Custom Storage** | Client's own cloud bucket (AWS S3, Azure Blob, GCS) | Client controls file storage |
| **Private Cloud** | Client's own cloud account (AWS, Azure, GCP) | Client controls all infrastructure |
| **Full On-Premise** | Client's own data centre/servers | Client controls everything |

For regulated industries requiring specific geographic data residency (e.g., EU data must stay in EU), Custom Storage and Private Cloud options allow you to choose your exact region.

---

## 5. AI Processing & Data Handling

### 5.1 OpenAI API Usage
- Evident uses OpenAI's API for AI features (chat, embeddings, document analysis)
- **OpenAI does NOT train models on API data** — this is covered under OpenAI's API data usage policy and their Data Processing Agreement (DPA)
- Queries are processed in real-time and are not stored by OpenAI beyond the processing window
- Enterprise clients can request a copy of OpenAI's DPA for their records

### 5.2 Local AI Option (On-Premise Tier)
- For air-gapped environments, Evident supports **self-hosted AI models** (e.g., Llama, Mistral via Ollama/vLLM)
- No data leaves the client's network — all AI processing happens locally
- Suitable for government, defence, and highly regulated industries

### 5.3 Data Processing Principles
- **Minimisation:** We only process data necessary for the requested function
- **Isolation:** Each organisation's data is logically isolated — no cross-tenant data access
- **Purpose limitation:** Document content is used only for the features you activate (search, Q&A, analysis)

---

## 6. Access Control & Authentication

### 6.1 User Authentication
- Passwordless email verification (primary method)
- Session-based authentication with secure, HTTP-only cookies
- Session expiry and automatic logout after inactivity
- Future: SSO/SAML integration with enterprise identity providers (Active Directory, Okta, Azure AD)

### 6.2 Role-Based Access Control (RBAC)
- **Super Admin:** Full platform access, user management, all settings
- **Admin:** Organisation-level management, document oversight
- **User:** Standard access to assigned documents and features
- **Viewer:** Read-only access (configurable)
- Future: Integration with client's existing RBAC/directory services

### 6.3 API Security
- All API endpoints require authentication
- Rate limiting to prevent abuse
- Input validation and sanitisation on all endpoints
- CORS policy enforcement

---

## 7. Content Protection

Evident includes multiple layers of content protection:

| Layer | Purpose |
|-------|---------|
| **Content Moderation** | Screens inputs and outputs for harmful content |
| **Prompt Injection Detection** | Prevents manipulation of AI behaviour through malicious inputs |
| **Answer Quality Validation** | Ensures AI responses are grounded in source documents |
| **Source Verification** | Citations link back to actual document content |
| **Audit Logging** | All significant actions are logged for compliance review |

---

## 8. Infrastructure Security

### 8.1 Hosting Environment
- Hosted on **Google Cloud Platform** (Evident Cloud tier)
- Automatic scaling and load balancing
- DDoS protection at the infrastructure level
- Regular security patches and updates

### 8.2 Database Security
- PostgreSQL with enforced authentication
- Connection encryption (SSL/TLS)
- Regular automated backups
- Point-in-time recovery capability

### 8.3 Monitoring & Incident Response
- Real-time application monitoring and alerting
- Self-healing service for automatic recovery from transient failures
- Error tracking and logging (without exposing sensitive data)
- Defined incident response process for security events

---

## 9. Data Retention & Deletion

### 9.1 Active Data
- Documents and data are retained as long as the account is active
- Users can delete individual documents at any time — deletion removes the file, embeddings, and associated metadata

### 9.2 Account Termination
- Upon contract termination, all organisation data is:
  - Made available for export (30-day window)
  - Permanently deleted from all systems after the export window
  - Deletion includes files, database records, embeddings, and backups
- Deletion confirmation provided in writing upon request

### 9.3 Backup Retention
- Automated backups retained for 30 days
- Backups are encrypted and access-controlled
- Backup data follows the same deletion policy as primary data

---

## 10. Compliance Path

| Standard | Status |
|----------|--------|
| GDPR | Compliant (data minimisation, right to deletion, DPA available) |
| SOC 2 Type II | On roadmap (planned for 2026–2027) |
| ISO 27001 | On roadmap |
| HIPAA | Achievable with Private Cloud or On-Premise deployment |
| CCPA | Compliant |

---

## 11. Shared Responsibility Model

| Responsibility | Evident Cloud | Custom Storage | Private Cloud | On-Premise |
|---------------|--------------|----------------|---------------|------------|
| Application security | Evident | Evident | Evident | Evident |
| Infrastructure security | Evident | Evident | Shared | Client |
| File storage security | Evident | Client | Client | Client |
| Network security | Evident | Evident | Client | Client |
| User access management | Shared | Shared | Shared | Client |
| Encryption key management | Evident | Shared | Client | Client |
| Compliance certification | Evident | Shared | Shared | Client |

---

## 12. Contact

For security questions, data processing agreements, or compliance documentation:

- **Email:** security@evident.ai
- **Enterprise Sales:** enterprise@evident.ai

---

*This document is updated quarterly. Last updated: March 2026.*
