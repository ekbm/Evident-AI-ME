# Evident - Scaling Roadmap

## Current Capacity Analysis

### OpenAI API Rate Limits

**Current limit:** 50 requests per minute

**Requests per user action:**
| Action | API Calls |
|--------|-----------|
| Ask a question | 1 embedding + 1 chat = 2 calls |
| Upload document (10 pages) | ~10 embedding calls |
| Contract analysis | 1 chat call |
| Image OCR | 1 vision call |
| Audio transcription | 1 whisper call |

### Concurrent User Capacity (50 req/min)

Assuming users primarily ask questions (2 API calls each):

| User Behavior | Max Concurrent Users |
|--------------|---------------------|
| 1 question every 2 minutes (power user) | ~50 users |
| 1 question every 5 minutes (active user) | ~125 users |
| 1 question every 10 minutes (casual user) | ~250 users |
| Mixed usage (realistic blend) | ~100-150 users |

**Formula:** `(50 requests/min) ÷ (2 calls/question) × (minutes between questions) = concurrent users`

### Scaling OpenAI Limits

| Tier | Rate Limit | Est. Concurrent Users |
|------|------------|----------------------|
| Tier 1 (default) | 50 req/min | ~100-150 |
| Tier 2 | 500 req/min | ~1,000-1,500 |
| Tier 3 | 5,000 req/min | ~10,000-15,000 |
| Tier 4 | 10,000 req/min | ~20,000-30,000 |
| Enterprise | Custom | Unlimited |

**How to increase:** OpenAI automatically increases limits based on usage and payment history. You can also request increases via their dashboard.

---

## Component Scalability Analysis

### 1. File Storage (Object Storage) ✅ READY

**Status:** Enterprise-ready (migrated January 2026)

| Scale | Capacity |
|-------|----------|
| Current | Unlimited (Google Cloud Storage) |
| 10K users | No changes needed |
| 100K users | No changes needed |
| 1M users | No changes needed |

**Why:** Direct-to-cloud uploads via presigned URLs. Zero server load.

---

### 2. PostgreSQL Database ✅ READY

**Status:** Scalable (Replit Neon-backed)

| Scale | Current | Upgrade Path |
|-------|---------|--------------|
| 10K users | Works fine | None needed |
| 50K users | May slow down | Add connection pooling |
| 100K users | Connection limits | Read replicas |

**Key tables to monitor:**
- `job_queue` - High write volume
- `sessions` - Frequent reads/writes
- `usage_daily` - Growing over time

**Upgrade triggers:**
- Query latency > 100ms consistently
- Connection pool exhaustion
- Database CPU > 80%

---

### 3. SQLite (Documents/Chunks) ⚠️ NEEDS MONITORING

**Status:** Single-server bottleneck

| Scale | Current | Upgrade Path |
|-------|---------|--------------|
| 10K users | Works fine | None needed |
| 25K users | May slow down | Migrate to PostgreSQL |
| 50K+ users | Bottleneck | Dedicated document DB |

**Why SQLite works now:**
- Write-ahead logging (WAL) mode
- Single writer, multiple readers
- Simple operations (no complex joins)

**Migration path when needed:**
1. Create PostgreSQL tables mirroring SQLite schema
2. Dual-write to both databases during migration
3. Switch reads to PostgreSQL
4. Decommission SQLite

---

### 4. Job Queue ✅ READY

**Status:** Designed for scale

| Scale | Current | Upgrade Path |
|-------|---------|--------------|
| 10K users | Works fine | None needed |
| 50K users | Queue grows | Add worker processes |
| 100K users | Parallel processing | Multiple job workers |

**Current features:**
- Priority-based processing (premium first)
- Atomic job claiming (no duplicates)
- Automatic retry with backoff
- Stuck job recovery

**Scaling mechanism:**
- Spawn additional worker processes
- Each worker claims jobs independently
- No code changes needed

---

### 5. Express Server ⚠️ NEEDS MONITORING

**Status:** Single process

| Scale | Current | Upgrade Path |
|-------|---------|--------------|
| 5K concurrent | Works fine | None needed |
| 10K concurrent | May strain | Add PM2 cluster mode |
| 50K+ concurrent | Bottleneck | Load balancer + multiple instances |

**Upgrade path:**
1. Add PM2 for cluster mode (automatic with Node.js)
2. Add Nginx/Caddy load balancer
3. Deploy multiple Replit instances behind load balancer

---

## Monitoring Checkpoints

### Daily Monitoring (Essential)

```bash
# Check job queue health
GET /api/admin/metrics
# Look for: queueDepth, avgProcessingTime, errorRate

# Check response times
# Target: API responses < 500ms, job processing < 30s
```

### Weekly Monitoring

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Job queue depth | > 100 | > 500 | Add workers |
| Avg processing time | > 10s | > 30s | Check OpenAI limits |
| Database query time | > 50ms | > 200ms | Add connection pool |
| Error rate | > 1% | > 5% | Investigate immediately |

### Scaling Decision Matrix

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Slow uploads | Object storage ✅ (not the issue) | Check client network |
| Slow questions | OpenAI rate limit | Request higher tier |
| Job queue growing | Workers can't keep up | Add worker processes |
| Database timeouts | Connection exhaustion | Connection pooling |
| Server unresponsive | Memory/CPU limits | Cluster mode or more instances |

---

## Upgrade Timeline Recommendations

### Phase 1: 0-10,000 Users (Current)
- ✅ Object Storage (done)
- ✅ Job Queue with priorities (done)
- ✅ Rate limiting (done)
- Monitor metrics weekly

### Phase 2: 10,000-50,000 Users
- Request OpenAI Tier 2 (500 req/min)
- Add PostgreSQL connection pooling
- Consider SQLite → PostgreSQL migration for documents
- Add PM2 cluster mode

### Phase 3: 50,000-100,000 Users
- Request OpenAI Tier 3+ (5,000 req/min)
- Migrate documents to PostgreSQL
- Add read replicas
- Multiple worker processes

### Phase 4: 100,000+ Users
- OpenAI Enterprise agreement
- Dedicated database instances
- Load balancer with multiple app instances
- Consider dedicated search (Elasticsearch/Pinecone)

---

## Cost Projections at Scale

| Users | OpenAI | Storage | Database | Total/Month |
|-------|--------|---------|----------|-------------|
| 1,000 | ~$100 | ~$4 | $0 (included) | ~$104 |
| 10,000 | ~$1,000 | ~$40 | ~$50 | ~$1,090 |
| 50,000 | ~$5,000 | ~$200 | ~$200 | ~$5,400 |
| 100,000 | ~$10,000 | ~$400 | ~$500 | ~$10,900 |

**Revenue at scale (assuming 10% paid conversion, $39 avg):**
- 10,000 users → 1,000 paid × $39 = $39,000/month
- 100,000 users → 10,000 paid × $39 = $390,000/month

**Margin remains healthy at all scales.**

---

---

## Enterprise Feature Roadmap

### Pricing Model: $2.99/user/month (Usage-Based Hybrid)

**Base plan includes:**
- Full platform access (Chat with Evi, Knowledge Space, Knowledge Health)
- Document uploads (500MB/user)
- All file types (PDF, Word, images, audio, video)
- AI Readiness scoring and document scanning
- Obligation extraction and checklists
- External integrations (SharePoint, Google Drive, Confluence, CRM)
- Team admin console and user management
- Standard cloud storage (Google Cloud)
- Email support
- 100 free AI queries/user/month

**Usage-based pricing (after free allowance):**
| Action | Cost |
|--------|------|
| AI Q&A query | $0.015/query |
| Document processing (OCR, prep) | $0.02/document |
| Deep scan | $0.03/document |
| CV/Report generation | $0.05/generation |

**Optional add-ons (for Cloud tier):**
| Add-on | Cost |
|--------|------|
| Priority support & SLA | +$1/user/month |
| Custom integrations setup | $2,000–5,000 one-time |

**Higher tiers:**
| Tier | Cost | What changes |
|------|------|-------------|
| Custom Storage | $7.99/user/month | Client's own S3/Azure/GCS bucket |
| Private Cloud | $14.99/user/month | Dedicated instance in client's cloud (min 100 users) |
| Full On-Premise | Quote-based | Client's own servers, optional local AI (min 250 users) |

**Profitability (per 100 users, avg 80 queries/user):**
| Item | Amount |
|------|--------|
| Base revenue | $299/month |
| AI costs | ~$60/month |
| Storage | ~$15/month |
| Infrastructure | ~$30/month |
| **Gross profit** | **~$194/month (~65%)** |

---

### Enterprise Customisation Features (Development Phases)

#### Phase E1: Custom Modes System
- **Priority:** High
- **Description:** Allow enterprise admins to configure which AI modes are available for their organisation (e.g., a law firm enables only Legal and Compliance, disables Study and Finance). Includes mode ordering, default mode per role, and custom mode creation.
- **Key work:** Admin UI for mode management, per-org mode configuration table, mode visibility rules based on org settings.
- **Status:** Planned

#### Phase E2: RBAC Integration
- **Priority:** High
- **Description:** Connect to enterprise identity providers (Active Directory, Okta, Azure AD) so permissions flow from existing systems. Users see only documents and features they are authorised for. Supports role-based document access, feature gating by role, and admin delegation.
- **Key work:** SSO/SAML integration, role-to-permission mapping, document-level access control, RBAC admin panel.
- **Status:** Planned

#### Phase E3: Intent-Based Document Routing
- **Priority:** Medium
- **Description:** Automatically detect document type on upload (contract, policy, financial report, HR document, technical spec) and route queries through the most appropriate processing pipeline. The AI adapts its behaviour based on document type without users needing to select a mode.
- **Key work:** Document type classifier (using OpenAI or fine-tuned model), routing rules engine, per-type prompt templates, admin override for misclassified documents.
- **Status:** Planned

#### Phase E4: Search Learning & Popular Queries
- **Priority:** Medium
- **Description:** Track what users search for most frequently, learn from query patterns, and surface popular/trending queries as suggestions. Auto-complete from organisational knowledge. Build a "most searched" index per organisation that improves over time.
- **Key work:** Query logging and aggregation table, trending queries algorithm, search suggestion API, auto-complete UI component, admin dashboard for search analytics.
- **Status:** Planned

#### Phase E5: Private Storage (Bring Your Own Bucket)
- **Priority:** Low (add-on)
- **Description:** Enterprise clients configure their own cloud storage (AWS S3, Azure Blob, Google Cloud) or on-premise storage. Documents never leave their infrastructure. Evident processes and indexes but stores files in the client's bucket.
- **Key work:** Storage adapter interface, S3/Azure/GCS client implementations, credential management, file routing based on org config.
- **Status:** Planned

#### Phase E6: Enterprise Analytics & Usage Billing
- **Priority:** High
- **Description:** Metered AI usage tracking per user, per-query cost attribution, usage dashboards for enterprise admins, and Stripe integration for overage billing. Includes the 100 free queries/month allowance and transparent overage reporting.
- **Key work:** Query counter per user/month, usage summary API, admin usage dashboard, Stripe metered billing integration, monthly usage reports.
- **Status:** Planned

#### Phase E7: Self-Service Integration Setup for IT
- **Priority:** High
- **Description:** After enterprise sign-up, IT admins can connect external apps themselves through a guided setup wizard — no Evident support needed. Covers SharePoint, Google Drive, Confluence, Slack, CRM systems, and more. Each integration has a step-by-step flow: authenticate, select folders/channels, set sync frequency, test connection, and go live.
- **Key work:**
  - Integration marketplace UI (list of available connectors with status)
  - OAuth-based connect flow per service (SharePoint via Microsoft Graph, Google Drive via Google API, Confluence via Atlassian API, Slack via Slack API)
  - Configuration wizard: select which folders/spaces/channels to sync, set sync schedule (real-time, hourly, daily)
  - Connection health dashboard: sync status, last sync time, document count, error alerts
  - Test connection button with instant feedback
  - Disconnect/reconnect without data loss
  - API key-based connectors for CRM and custom systems
  - Webhook support for real-time document updates from connected sources
- **IT admin experience:** Sign up → Admin Console → Integrations tab → Click "Connect" → OAuth login → Select folders → Set schedule → Done. No developer needed.
- **Status:** Planned

#### Phase E8: Offline Data Ingestion (No Integration Possible)
- **Priority:** High
- **Description:** For enterprises where direct API integration is not possible due to security policies, legacy systems, or lack of supported connectors. Provides alternative ways to get data into Evident without needing live connections to external systems.
- **Methods:**
  - **Scheduled Bulk Upload:** IT admin schedules automated file ingestion from a designated drop folder (SFTP, shared network drive, or cloud bucket). Evident picks up new/changed files on a schedule (every 15 min, hourly, daily, weekly). No live API connection needed — just drop files in a folder.
  - **CSV/Excel Data Import:** Upload structured data (employee records, asset inventories, compliance checklists) via CSV/Excel. Map columns to Evident fields through a visual mapper. Supports recurring imports on a schedule.
  - **Email Ingestion:** Dedicated email address per organisation (e.g., ingest@acme.evident.ai). Forward or auto-route emails with attachments — Evident processes them automatically. Works with mail rules in Outlook/Gmail to automate without IT effort.
  - **Manual Batch Upload:** Admin uploads a ZIP of documents through the admin console. Evident unpacks, processes, and indexes all files. Useful for initial data migration or periodic bulk updates.
  - **API Push (for IT teams with custom scripts):** Simple REST API endpoint where the client's own scripts or ETL tools push files and metadata to Evident. Includes API keys, rate limiting, and upload receipts. Documentation and code samples provided.
  - **Desktop Agent (future):** Lightweight app installed on a shared server or user machine that watches specified folders and automatically uploads new/changed files to Evident. Works behind firewalls without inbound connections.
- **Key work:**
  - SFTP server / drop folder watcher service
  - Scheduled ingestion job runner (cron-based)
  - CSV/Excel import wizard with column mapping UI
  - Email ingestion service (receive and parse emails)
  - Batch upload (ZIP) processor
  - Ingestion API endpoint with auth and documentation
  - Ingestion activity log (what was uploaded, when, status, errors)
  - Admin dashboard: ingestion history, schedule management, error alerts
  - Desktop agent (future phase)
- **IT admin experience:** Admin Console → Data Ingestion → Choose method (Drop Folder / CSV Import / Email / API) → Configure schedule → Monitor via ingestion log. No live integration needed.
- **Status:** Planned

#### Phase E9: Proactive AI Insights & Review Workflow
- **Priority:** High
- **Description:** After a document is uploaded and processed, Evident automatically analyses it and generates actionable insights — flagging risks, anomalies, missing sections, and deviations from the organisation's existing documents and policies. Insights can be sent to specific teams for review and approval, creating a lightweight governance workflow without leaving Evident.
- **How it works:**
  1. **Auto-analysis on ingestion:** Once a document is processed, Evident runs an insight scan comparing it against:
     - The document's own content (risk clauses, liability terms, unusual language)
     - Similar documents already in the system (e.g., "your other vendor contracts all include a 30-day notice period — this one doesn't")
     - Organisation's past query history and flagged items (e.g., "teams have previously questioned indemnity clauses like this")
     - Policy templates or compliance baselines (if configured)
  2. **Insight cards generated:** Each insight is a clear, actionable item, for example:
     - "Section 12 introduces a vendor liability risk — differs from your standard agreement"
     - "Termination clause missing notice period — present in 90% of your contracts"
     - "Data processing terms don't align with your company policy template"
     - "Non-compete scope is broader than industry standard"
     - "Payment terms changed from NET 30 to NET 60 compared to previous version"
  3. **Review & notify workflow:**
     - User clicks "Send for review" on any insight
     - Selects a team or individual (e.g., @Legal, @Compliance, @Finance, or specific user)
     - Adds an optional note (e.g., "Please confirm this is acceptable")
     - Recipient gets notified (email + in-app notification)
     - Recipient reviews and responds: **Accept** / **Flag for Change** / **Escalate**
     - Status tracked on the document's insight panel (Pending → Reviewed → Accepted/Flagged)
     - Full audit trail of who reviewed what and when
  4. **Insight dashboard:**
     - Admin view: all pending insights across the organisation
     - Filter by team, status (Pending/Accepted/Flagged), risk level, document type
     - Metrics: average review time, top flagged issues, documents with most insights
- **Insight types:**
  | Type | Example | Detected By |
  |------|---------|-------------|
  | Risk clause | "Vendor liability risk in Section 12" | Content analysis |
  | Missing section | "No termination notice period" | Comparison with similar docs |
  | Policy deviation | "Data terms don't match company policy" | Policy template comparison |
  | Unusual terms | "Non-compete scope broader than standard" | Industry baseline comparison |
  | Version change | "Payment terms changed from NET 30 to NET 60" | Previous version comparison |
  | Compliance gap | "GDPR data subject rights not addressed" | Compliance checklist |
  | Historical flag | "Teams previously questioned similar clauses" | Query history analysis |
- **Key work:**
  - Post-ingestion insight analysis job (runs after document prep completes)
  - Similar document comparison engine (using existing embeddings + metadata)
  - Query history analysis (aggregate past questions and flagged items per org)
  - Policy template matching (optional admin-configured baselines)
  - Insight cards UI on document detail panel
  - Review workflow: send for review, team notification, response tracking
  - Notification service: email + in-app notifications for review requests
  - Teams/recipients management (create teams like Legal, Compliance, Finance)
  - Insight dashboard for admins (pending reviews, metrics, audit trail)
  - Insight API for external consumption
  - **Shareable insight links** (copy link per insight card for external sharing)
- **Sharing options (per insight card):**
  - **Copy Link** — Generates a unique URL (e.g., `evident.ai/insight/abc123`), copies to clipboard with toast confirmation
  - **Share button** — Opens a share menu with direct options:
    - **Slack** — Opens Slack with a pre-formatted message containing the insight summary and link (via Slack deep link or webhook)
    - **Microsoft Teams** — Opens Teams share dialog with the insight link and context
    - **Email** — Opens default email client with pre-filled subject ("Evident Insight: [title]") and body (insight summary + link)
    - **WhatsApp** — Share link with summary text
    - **Copy Link** — Fallback option always available at the bottom
  - Each platform option shows its brand icon (Slack, Teams, etc.) for quick recognition
  - Recipients see the insight summary, source section, and document name when they open the link
  - Access controlled: only users with document permission see full detail; others see a summary with a prompt to request access
  - Share actions logged in audit trail (who shared what, where, when)
- **User experience:** Upload document → Evident processes it → Insight cards appear → "Section 12 introduces a vendor liability risk" → Click "Copy Link" to share on Slack/email/Teams, or click "Send for Review" → Select "@Legal team" → Add note "Please confirm this is acceptable" → Legal gets notified → Legal reviews and marks as Accepted → Status updates in real-time → Full audit trail saved.
- **Status:** Planned

---

### Enterprise Collaboration — Four Pillars

Evident's collaboration approach is focused and purposeful — it enhances document intelligence workflows without becoming a communication tool. Everything ties back to the core principle: **Document → AI Insight → Human Decision**.

#### 1. Shared Workspaces
- Teams can create shared document collections that all members can query against
- Role-based access: who can view, upload, or manage documents in each workspace
- Workspace-level AI insights: aggregated view of insights across all documents in the workspace
- Admin controls: create/archive workspaces, manage membership

#### 2. Comments & @Mentions
- Add comments on AI insights, document findings, and answers
- @mention colleagues to bring their attention to a specific insight or finding
- Threaded replies for focused discussions within context
- Comments stay attached to the insight/document — no separate chat stream

#### 3. Assign Actions
- Assign insights for review to specific users or teams (Legal, Compliance, Finance, etc.)
- Status tracking: Pending → In Review → Accepted / Flagged / Escalated
- Due dates and priority levels on assigned actions
- Admin dashboard: all pending actions across the organisation with filters and metrics
- Full audit trail: who assigned, who reviewed, when, what decision

#### 4. Deep Shareable Links
- Every insight, answer, and document finding gets a unique shareable URL
- Share menu with direct options: Slack, Microsoft Teams, Email, WhatsApp, Copy Link
- Links open with full context (insight summary, source section, document name)
- Access controlled: document permission required for full detail
- Pre-formatted messages for each platform (subject lines, summaries included)
- All share actions logged in audit trail

**Design principle:** These features support the document intelligence workflow — not replace communication tools. Evident is where decisions are informed, not where conversations happen.

---

### Full Audit Trail (Activity Log)

A complete, searchable record of everything that happens across the organisation in Evident. Essential for compliance, governance, and enterprise security requirements.

**What's logged:**

| Category | Events Tracked |
|----------|---------------|
| **Documents** | Upload, delete, rename, move to folder, share, download, prepare, deep scan |
| **AI Queries** | Every question asked, which documents were queried, AI response summary, mode used |
| **Insights** | Insight generated, viewed, sent for review, shared (with platform), accepted, flagged, escalated |
| **Users** | Login, logout, account created, role changed, permissions updated, invitation sent/accepted |
| **Workspaces** | Created, archived, member added/removed, documents added/removed |
| **Admin Actions** | Settings changed, integrations connected/disconnected, user managed, bulk operations |
| **Data Ingestion** | Files ingested (source, method, schedule), sync events, import errors |
| **Sharing** | Links generated, external shares (Slack/Teams/Email), access requests |

**Features:**
- **Searchable log:** Filter by user, action type, date range, document, team
- **Export:** Download as CSV or PDF for compliance reporting
- **Retention policy:** Configurable retention period (default 1 year, extendable for compliance)
- **Real-time feed:** Live activity stream for admins
- **Immutable records:** Logs cannot be edited or deleted — ensures integrity for auditors
- **API access:** Query audit logs programmatically for integration with external SIEM or compliance tools
- **Alerts:** Configurable alerts for specific events (e.g., bulk downloads, permission changes, failed login attempts)

**Access:**
- Super admins: Full audit log access
- Team admins: Activity within their team/workspace only
- Regular users: Their own activity only
- External auditors: Read-only access via time-limited shared link (configurable)

---

### Enterprise Deployment Options

#### Option 1: Evident Cloud (Default) — $2.99/user/month
- **Hosting:** Evident-managed cloud infrastructure
- **Storage:** Google Cloud Storage (included)
- **Best for:** Teams that want zero setup, fast onboarding, automatic updates
- **Data location:** Google Cloud (multi-region)
- **Security:** Encryption at rest and in transit, SOC 2 compliance path
- **Updates:** Automatic, zero-downtime deployments

#### Option 2: Custom Storage — $7.99/user/month
- **Hosting:** Evident-managed cloud infrastructure
- **Storage:** Client provides their own bucket (AWS S3, Azure Blob, or Google Cloud Storage)
- **Best for:** Organisations that need data residency control but are comfortable with cloud-hosted application
- **How it works:** Evident app runs in our cloud, but all documents are stored in the client's own storage account. Only processed data (embeddings, metadata) stays in Evident's database.
- **Setup:** IT admin provides bucket credentials and region via the admin console. Evident validates and starts routing files.
- **Key work:** Storage adapter layer, per-org storage config, credential vault, dual-read capability (Evident storage + client storage)

#### Option 3: Private Cloud — $14.99/user/month (min 100 users)
- **Hosting:** Dedicated instance in client's cloud account (AWS, Azure, or GCP)
- **Storage:** Client's own cloud storage within their account
- **Best for:** Organisations needing full cloud isolation — their own VPC, no shared infrastructure
- **How it works:** Evident deploys a dedicated instance into the client's cloud subscription. All data (files, database, embeddings) stays within their cloud account. Evident manages and updates the deployment remotely.
- **Includes:** Dedicated database, dedicated compute, network isolation, client-managed encryption keys
- **Setup:** Evident DevOps provisions via Terraform/Pulumi into client's cloud. IT provides a service account with required permissions.
- **Key work:** Infrastructure-as-code templates (AWS/Azure/GCP), automated deployment pipeline, remote monitoring and update agent, client-side health checks

#### Option 4: Full On-Premise — Quote-based (min 250 users)
- **Hosting:** Client's own data centre or private servers
- **Storage:** Client's on-premise storage (NAS, SAN, local file systems)
- **Best for:** Highly regulated industries (government, defence, banking, healthcare) where no data can leave the premises
- **How it works:** Evident provides a containerised deployment package (Docker/Kubernetes) that runs entirely within the client's infrastructure. No data ever leaves their network.
- **Includes:** Containerised app (Docker images), Kubernetes Helm charts, offline AI model option (local LLM instead of OpenAI), air-gapped deployment support, on-site installation guide
- **AI options:**
  - **Cloud AI** (default): Queries go to OpenAI API (requires internet access from servers)
  - **Local AI** (add-on): Self-hosted LLM (e.g., Llama, Mistral) for fully air-gapped environments — no external API calls, all processing on-premise
- **Setup:** Evident provides deployment package + installation support. Client's IT runs the deployment. Evident provides remote or on-site assistance.
- **Ongoing:** Client manages infrastructure. Evident provides update packages (quarterly releases), remote support, and upgrade guides.
- **Key work:** Docker containerisation, Kubernetes Helm charts, local LLM integration (Ollama/vLLM), offline embedding model, air-gap deployment scripts, update packaging system

---

### Deployment Comparison Summary

| Feature | Cloud ($2.99) | Custom Storage ($7.99) | Private Cloud ($14.99) | On-Premise (Quote) |
|---------|--------------|----------------------|---------------------|-------------------|
| Hosting | Evident | Evident | Client's cloud | Client's servers |
| File storage | Evident (GCS) | Client's bucket | Client's cloud | Client's on-prem |
| Database | Shared | Shared | Dedicated | Client-managed |
| Data residency | Multi-region | Client chooses | Client chooses | Client's premises |
| AI processing | OpenAI API | OpenAI API | OpenAI API | OpenAI or local LLM |
| Updates | Automatic | Automatic | Managed by Evident | Quarterly packages |
| Setup time | Instant | 1–2 hours | 1–2 weeks | 2–4 weeks |
| Min users | None | None | 100 | 250 |
| IT effort | None | Minimal | Low | Medium |

---

*Document created: January 2026*
*Enterprise roadmap added: March 2026*
*Deployment options & self-service integrations added: March 2026*
*Review quarterly or when approaching next user threshold*
