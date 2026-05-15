# Evident - Technical Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Architecture](#database-architecture)
4. [Job Queue System](#job-queue-system)
5. [File Processing Pipeline](#file-processing-pipeline)
6. [API Reference](#api-reference)
7. [Frontend Architecture](#frontend-architecture)
8. [Authentication & Authorization](#authentication--authorization)
9. [AI Integration](#ai-integration)
10. [Enterprise Features](#enterprise-features)

---

## System Overview

Evident is a privacy-first, evidence-based AI assistant that enables users to:
- Upload documents (PDF, DOCX, Excel, images, audio, video)
- Ask questions and receive AI-powered answers with citations
- Analyze contracts for obligations, risks, and compliance
- Track AI-readiness scores across document collections
- Generate reports, proposals, and presentations

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React + TypeScript + Vite + TanStack Query + shadcn/ui         │
│  Port: 5000 (served by Express in production)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS BACKEND                             │
│  Node.js + TypeScript + Multer                                  │
│  RESTful API under /api/*                                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Routes     │  │  Job Queue   │  │  File Processors     │  │
│  │  /api/...    │  │  Background  │  │  PDF, DOCX, Media    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│   PostgreSQL    │  │     SQLite      │  │    OpenAI API       │
│   (Auth/Billing)│  │  (Documents)    │  │  (Embeddings/Chat)  │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Wouter | Client-side routing |
| TanStack Query | Server state management |
| shadcn/ui | Component library (Radix UI based) |
| Tailwind CSS | Styling |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express | HTTP server |
| TypeScript | Type safety |
| Multer | File uploads |
| Drizzle ORM | PostgreSQL queries |
| better-sqlite3 | SQLite for documents |

### Databases
| Database | Purpose |
|----------|---------|
| PostgreSQL | Users, sessions, subscriptions, entitlements, job queue |
| SQLite | Assets (documents), chunks, embeddings, artifacts |

### External Services
| Service | Purpose |
|---------|---------|
| OpenAI | Embeddings, chat completions, vision, transcription |
| Stripe | Subscription billing |
| Firebase | Analytics (optional) |

---

## Database Architecture

### PostgreSQL Tables (Auth & Billing)

Located in: `shared/models/auth.ts`

```typescript
// Core tables
users              // User accounts
sessions           // Session storage (Replit Auth)
subscriptions      // Stripe subscription state
entitlements       // Feature access per user
user_plans         // Plan tracking

// Usage tracking
usage_daily        // Daily usage metrics
usage_monthly      // Monthly aggregates
early_access_usage // Lifetime limits for free tier
document_hashes    // SHA-256 deduplication

// Enterprise features
workspaces         // Workspace containers
workspace_assets   // Asset-workspace mapping
workspace_policies // AI answer policies
reports            // Scheduled reports
training_exports   // Data export tracking

// Organizations
organizations      // Multi-tenant orgs
organization_members // Org membership
org_invites        // Pending invitations

// Job Queue
job_queue          // Background task queue
```

### SQLite Tables (Documents)

Located in: `server/db.ts`

```typescript
assets     // Uploaded files with metadata
chunks     // Text chunks with embeddings
artifacts  // Generated content (obligations, analysis)
```

---

## Job Queue System

### Overview

The job queue provides reliable background processing with:
- **Atomic job claiming** using `SELECT FOR UPDATE SKIP LOCKED`
- **Priority-based processing** (premium users first)
- **Automatic retries** with exponential backoff
- **Rate limiting** for OpenAI API protection
- **Stuck job recovery** on server restart

### Files

| File | Purpose |
|------|---------|
| `server/job-queue.ts` | Queue management, job creation, processing loop |
| `server/job-processors.ts` | Job type handlers |
| `shared/models/auth.ts` | Job queue schema and types |
| `client/src/hooks/use-job-status.ts` | Frontend polling hook |

### Job Types

```typescript
const JOB_TYPES = {
  FILE_INGESTION: "file_ingestion",      // Document processing
  EMBEDDING_GENERATION: "embedding_generation",
  LLM_CHAT: "llm_chat",                  // Q&A processing
  CONTRACT_ANALYSIS: "contract_analysis", // Contract review
  TRANSCRIPTION: "transcription",         // Audio/video
  IMAGE_ANALYSIS: "image_analysis",       // OCR/captioning
  DOCUMENT_PREP: "document_prep",         // AI-readiness prep
};
```

### Job Lifecycle

```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED (after max retries)
                    ↘ CANCELLED (by user)
```

### Priority Levels

```typescript
const JOB_PRIORITY = {
  LOW: 1,        // Free tier
  NORMAL: 5,     // Paid users
  HIGH: 10,      // Premium users
  URGENT: 20,    // System-critical
};
```

### Usage Example

```typescript
// Creating a job (server-side)
import { createJob, JOB_TYPES } from "./job-queue";

const job = await createJob(
  JOB_TYPES.FILE_INGESTION,
  { assetId: "abc123", filePath: "/uploads/doc.pdf", mime: "application/pdf" },
  userId
);

// Checking job status (API)
GET /api/jobs/:jobId
// Returns: { id, status, result, error, queuePosition }

// Polling from frontend
import { useJobStatus } from "@/hooks/use-job-status";

const { job, isLoading } = useJobStatus(jobId, {
  pollInterval: 2000,
  enabled: !!jobId
});
```

### Recovery Mechanism

On server startup, jobs stuck in "processing" for >5 minutes are reset:

```typescript
export async function recoverStuckJobs(): Promise<number> {
  const stuckTimeout = new Date(Date.now() - 5 * 60 * 1000);
  // Reset stuck jobs to pending for retry
}
```

---

## File Processing Pipeline

### Ingestion Flow

```
Upload → Validate → Store → Queue Job → Process → Chunk → Embed → Ready
```

### Processors by File Type

| File Type | Processor | Location |
|-----------|-----------|----------|
| PDF | `ingest-pdf.ts` | PyMuPDF service or pdf-parse fallback |
| DOCX | `ingest-docx.ts` | mammoth library |
| Excel | `ingest-excel.ts` | xlsx library |
| PPTX | `ingest-pptx.ts` | officeparser |
| Images | `ingest-image.ts` | OpenAI Vision API |
| Audio/Video | `ingest-media.ts` | OpenAI Whisper |
| Text | `ingest-txt.ts` | Direct chunking |

### Chunking Strategy

```typescript
// server/ingest/chunker.ts
const CHUNK_SIZE = 1200;     // characters
const CHUNK_OVERLAP = 150;   // overlap between chunks
```

### Embedding Generation

```typescript
// Model: text-embedding-3-small
// Dimensions: 1536
// Storage: JSON array in SQLite chunks table
```

---

## API Reference

### Core Endpoints

#### Assets (Documents)

```
POST   /api/assets          # Upload file
GET    /api/assets          # List user's assets
GET    /api/assets/:id      # Get asset details
DELETE /api/assets/:id      # Delete asset
```

#### Chat (Q&A)

```
POST   /api/chat            # Sync question (immediate response)
POST   /api/chat/async      # Async question (returns job ID)
POST   /api/chat/external   # Q&A with web search augmentation
POST   /api/chat/image      # Search using image
```

#### Jobs

```
GET    /api/jobs/:id        # Get job status
GET    /api/jobs/:id/position  # Get queue position
POST   /api/jobs/:id/cancel    # Cancel pending job
```

#### Contract Analysis

```
POST   /api/contracts/:id/analyze     # Full contract analysis
GET    /api/contracts/:id/obligations # Get extracted obligations
```

#### AI Readiness

```
GET    /api/readiness/dashboard       # Dashboard scores
GET    /api/readiness/scan/:id        # Document scan results
POST   /api/readiness/prepare/:id     # Trigger AI-ready prep
```

#### Exports

```
POST   /api/exports/proposal    # Generate DOCX proposal
POST   /api/exports/presentation # Generate PPTX
POST   /api/exports/summary     # Generate summary document
```

### Authentication

All `/api/*` routes require authentication via session cookie (Replit Auth).

External API routes use bearer token or x-api-key header:
```
GET /api/v1/*       # Bearer token auth
GET /api/v0/*       # x-api-key header auth
```

---

## Frontend Architecture

### Directory Structure

```
client/src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── chat/            # Chat interface components
│   ├── dashboard/       # Dashboard components
│   └── landing/         # Landing page components
├── hooks/
│   ├── use-job-status.ts    # Job polling
│   ├── use-mobile.tsx       # Mobile detection
│   └── use-toast.ts         # Toast notifications
├── lib/
│   ├── queryClient.ts   # TanStack Query setup
│   └── utils.ts         # Utility functions
├── pages/
│   ├── simple-landing.tsx   # Main landing (/)
│   ├── full-landing.tsx     # Full features (/full)
│   └── ...
└── App.tsx              # Route definitions
```

### Key Patterns

#### Data Fetching

```typescript
// Using TanStack Query
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Fetching data
const { data: assets } = useQuery({
  queryKey: ["/api/assets"],
});

// Mutations with cache invalidation
const uploadMutation = useMutation({
  mutationFn: (formData: FormData) => 
    apiRequest("POST", "/api/assets", formData),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
  },
});
```

#### Routing

```typescript
// Using Wouter
import { Switch, Route, Link } from "wouter";

<Switch>
  <Route path="/" component={SimpleLanding} />
  <Route path="/full" component={FullLanding} />
  <Route path="/workspace" component={Workspace} />
</Switch>
```

---

## Authentication & Authorization

### Replit Auth Integration

Located in: `server/replit_integrations/auth/`

```typescript
// Session-based authentication
app.use(session({
  store: new PgStore({ pool }),
  secret: process.env.SESSION_SECRET,
  // ...
}));

// Auth check middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
}
```

### Plan-Based Access Control

```typescript
// Check user entitlements
const entitlement = await getUserEntitlement(userId);

if (!entitlement.hasLegalPack) {
  return res.status(403).json({ 
    message: "Legal Intelligence Pack required" 
  });
}
```

---

## AI Integration

### OpenAI Models Used

| Model | Purpose |
|-------|---------|
| `text-embedding-3-small` | Document embeddings |
| `gpt-4.1-mini` | Chat completions, obligation extraction |
| `gpt-4o-mini-transcribe` | Audio/video transcription |
| `gpt-4o` | Vision analysis (images) |

### RAG Pipeline

```
Question → Embed → Vector Search → Top-K Chunks → LLM + Context → Answer
```

Located in: `server/qa.ts`, `server/rag.ts`

### Rate Limiting

```typescript
// server/job-queue.ts
const OPENAI_RATE_LIMIT_WINDOW = 60000;  // 1 minute
const OPENAI_REQUESTS_PER_MINUTE = 50;
```

---

## Enterprise Features

### Workspaces

Group assets into workspaces with shared policies:

```typescript
// Create workspace
POST /api/workspaces
{ name: "Legal Documents" }

// Add asset to workspace
POST /api/workspaces/:id/assets
{ assetId: "abc123" }
```

### Policy Enforcement

Workspace policies can enable/disable AI answers:

```typescript
// Workspace policy states
POLICY_ENABLED   // AI answers allowed
POLICY_DISABLED  // AI answers blocked
POLICY_PENDING   // Waiting for admin config
```

### Intelligence Packs

Specialized AI modules controlled by entitlements:

| Pack | Features |
|------|----------|
| Legal | Contract analysis, obligation extraction |
| Finance | Financial document analysis |
| HR | Employee document processing |
| Procurement | Vendor/contract management |
| Construction | Project document analysis |
| Compliance | Regulatory compliance checking |

### Organizations

Multi-tenant support with role-based access:

```typescript
// Roles
OWNER    // Full control
ADMIN    // Manage members, policies
MEMBER   // Standard access
```

---

## Environment Variables

### Required Secrets

```bash
OPENAI_API_KEY          # OpenAI API access
SESSION_SECRET          # Express session encryption
DATABASE_URL            # PostgreSQL connection
STRIPE_SECRET_KEY       # Stripe billing (if enabled)
STRIPE_PUBLISHABLE_KEY  # Stripe frontend key
```

### Firebase (Optional)

```bash
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
# ... other Firebase config
```

---

## Deployment

### Replit Deployment

The application is configured for Replit deployment:

1. Frontend served on port 5000
2. Express handles both API and static file serving
3. PostgreSQL provided by Replit
4. SQLite stored in persistent filesystem

### Health Check

```
GET /api/health
# Returns: { status: "ok", timestamp: "..." }

GET /api/admin/metrics  # Admin only
# Returns: System metrics and health status
```

---

## Development

### Running Locally

```bash
npm run dev    # Starts both frontend and backend
```

### Database Migrations

```bash
npm run db:push    # Push schema changes (Drizzle)
```

### Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Database migrations |

---

## Pricing & Plan Calculations

### Pricing Tiers

| Plan | Monthly Price | Target User |
|------|--------------|-------------|
| **Free** | $0 | Trial users, evaluation |
| **Starter** | $5 | Individual light users |
| **Plus** | $24 | Power individuals |
| **Pro** | $39 | Professionals |
| **Premium** | $99 | Heavy users, teams |
| **Enterprise** | $299 | Organizations |

### Plan Limits Breakdown

```typescript
// From shared/models/auth.ts - PLAN_LIMITS

const PLAN_LIMITS = {
  free: {
    price: 0,
    storageBytes: 10 * 1024 * 1024,      // 10 MB
    queriesPerMonth: 5,                   // 5 questions
    maxFileSizeBytes: 5 * 1024 * 1024,   // 5 MB per file
    maxDocuments: 3,                      // 3 documents
    mediaMinutesPerMonth: 0,              // No audio/video
    mediaAllowed: false,
    externalSearchAllowed: false,
    excelReportsAllowed: false,
    workspacesAllowed: false,
  },
  
  starter: {
    price: 5,
    storageBytes: 100 * 1024 * 1024,     // 100 MB
    queriesPerMonth: 50,                  // 50 questions
    maxFileSizeBytes: 10 * 1024 * 1024,  // 10 MB per file
    maxDocuments: 50,                     // 50 documents
    mediaMinutesPerMonth: 0,
    mediaAllowed: false,
    externalSearchAllowed: false,
    excelReportsAllowed: false,
    workspacesAllowed: false,
  },
  
  plus: {
    price: 24,
    storageBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    queriesPerMonth: 500,                  // 500 questions
    maxFileSizeBytes: 25 * 1024 * 1024,   // 25 MB per file
    maxDocuments: 2000,                    // 2,000 documents
    mediaMinutesPerMonth: 60,              // 60 min audio/video
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    workspacesAllowed: false,
  },
  
  pro: {
    price: 39,
    storageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    queriesPerMonth: 500,                  // 500 questions
    maxFileSizeBytes: 25 * 1024 * 1024,   // 25 MB per file
    maxDocuments: 1000,                    // 1,000 documents
    mediaMinutesPerMonth: 60,              // 60 min audio/video
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    workspacesAllowed: false,
  },
  
  pro_plus: {  // "Premium"
    price: 99,
    storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    queriesPerMonth: 2000,                 // 2,000 questions
    maxFileSizeBytes: 50 * 1024 * 1024,   // 50 MB per file
    maxDocuments: 5000,                    // 5,000 documents
    mediaMinutesPerMonth: 180,             // 180 min (3 hours)
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    workspacesAllowed: true,
    scheduledReportsAllowed: true,
    trainingExportAllowed: true,
  },
  
  premium_org: {  // "Enterprise"
    price: 299,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    queriesPerMonth: 10000,                 // 10,000 questions
    maxFileSizeBytes: 100 * 1024 * 1024,   // 100 MB per file
    maxDocuments: 50000,                    // 50,000 documents
    mediaMinutesPerMonth: 600,              // 600 min (10 hours)
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    workspacesAllowed: true,
    scheduledReportsAllowed: true,
    trainingExportAllowed: true,
  },
};
```

### Cost Calculations

#### OpenAI API Costs (Approximate)

| Operation | Model | Cost per 1K tokens |
|-----------|-------|-------------------|
| Embeddings | text-embedding-3-small | $0.00002 |
| Chat | gpt-4.1-mini | $0.00015 input, $0.0006 output |
| Vision | gpt-4o | $0.0025 input |
| Transcription | whisper | $0.006 per minute |

#### Perplexity API Costs (Learning Mode Web Search)

| Operation | Model | Cost |
|-----------|-------|------|
| Web Search | llama-3.1-sonar-small-128k-online | ~$0.005 per request |

*Note: Perplexity is used for Learning Mode to fetch real, verifiable web sources. Each Learning Mode session = 1 Perplexity request. Optional - falls back to OpenAI if not configured.*

#### Per-User Cost Estimates

| Plan | Avg Docs | Avg Questions | Est. Monthly Cost |
|------|----------|---------------|-------------------|
| Free | 3 | 5 | ~$0.02 |
| Starter | 25 | 50 | ~$0.20 |
| Plus | 200 | 250 | ~$1.50 |
| Pro | 150 | 300 | ~$2.00 |
| Premium | 500 | 1000 | ~$6.00 |
| Enterprise | 2000 | 5000 | ~$30.00 |

#### Margin Calculation

```
Gross Margin = (Subscription Price - API Costs) / Subscription Price

Example (Pro at $39/month):
- Average API costs: ~$2.00
- Gross margin: ($39 - $2) / $39 = 95%

Example (Premium at $99/month):
- Average API costs: ~$6.00
- Gross margin: ($99 - $6) / $99 = 94%
```

### Feature Gating by Plan

| Feature | Free | Starter | Plus | Pro | Premium | Enterprise |
|---------|------|---------|------|-----|---------|------------|
| Document Upload | 3 | 50 | 2K | 1K | 5K | 50K |
| Questions/Month | 5 | 50 | 500 | 500 | 2K | 10K |
| Audio/Video | - | - | 60m | 60m | 180m | 600m |
| External Search | - | - | Yes | Yes | Yes | Yes |
| Excel Reports | - | - | Yes | Yes | Yes | Yes |
| Workspaces | - | - | - | - | Yes | Yes |
| Scheduled Reports | - | - | - | - | Yes | Yes |
| Intelligence Packs | - | - | - | - | Add-on | Included |

### Intelligence Pack Pricing

Intelligence Packs are add-on features controlled by the `entitlements` table:

| Pack | Monthly Add-on | Included in Enterprise |
|------|---------------|----------------------|
| Legal AI | $29 | Yes |
| Finance AI | $29 | Yes |
| HR AI | $19 | Yes |
| Procurement AI | $29 | Yes |
| Construction AI | $29 | Yes |
| Compliance AI | $29 | Yes |

### Scholar Tier (Special)

For students and educators with .edu email verification:
- **Price**: $29/month (vs $99 Premium)
- **Features**: Full Premium features
- **Verification**: Email domain validation

### Usage Tracking

```typescript
// Daily tracking (usage_daily table)
{
  userId: string,
  date: Date,
  uploadsCount: number,
  chatQueriesCount: number,
  embeddingTokens: number,
}

// Monthly aggregation (usage_monthly table)
{
  userId: string,
  month: Date,
  totalUploads: number,
  totalQueries: number,
  totalEmbeddingTokens: number,
  totalStorageBytes: number,
}
```

### Limit Enforcement

```typescript
// Check before upload
const canUpload = await checkUploadLimits(userId);
// Returns: { allowed: boolean, reason?: string }

// Check before question
const canAsk = await checkQuestionLimits(userId);
// Returns: null if allowed, error object if blocked

// Early Access limits (free tier)
const EARLY_ACCESS_LIMITS = {
  maxDocuments: 3,
  maxFileSizeBytes: 5 * 1024 * 1024,  // 5MB
  maxPagesPerDocument: 20,
  maxQuestionsLifetime: 25,
  questionsPerHour: 5,
};
```

### Stripe Integration

```typescript
// Webhook events handled
'checkout.session.completed'    // New subscription
'customer.subscription.updated' // Plan change
'customer.subscription.deleted' // Cancellation
'invoice.payment_failed'        // Payment issue

// Price IDs (configured in Stripe dashboard)
STRIPE_PRICE_STARTER = "price_xxx"
STRIPE_PRICE_PLUS = "price_xxx"
STRIPE_PRICE_PRO = "price_xxx"
STRIPE_PRICE_PREMIUM = "price_xxx"
STRIPE_PRICE_ENTERPRISE = "price_xxx"
```

---

## Addendum A: Object Storage Migration (January 2026)

### Problem Statement

The original file upload architecture used **Multer with local disk storage**. This approach encountered intermittent reliability issues:

- Files occasionally disappeared after Multer saved them to disk
- Local disk storage doesn't scale for enterprise workloads
- Memory-based file recovery was implemented as a workaround but added complexity
- No guaranteed durability for uploaded files

### Original Architecture (Local Disk)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Express + Multer │────▶│  Local Disk     │
│  (Browser)  │     │  /api/upload       │     │  /uploads/*     │
└─────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Read file from   │
                    │  disk + Process   │
                    └──────────────────┘
```

**Issues:**
- Single point of failure (local filesystem)
- Files vanish intermittently after upload
- Memory buffering workaround increased server memory usage
- Not scalable beyond single server deployment

### New Architecture (Object Storage with Presigned URLs)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Client    │────▶│  Express API      │────▶│  Generate Presigned │
│  (Browser)  │     │  /api/uploads/    │     │  URL (metadata only)│
└─────────────┘     │  request-url      │     └─────────────────────┘
       │            └──────────────────┘              │
       │                                               ▼
       │            ┌──────────────────────────────────────────────┐
       └───────────▶│  Google Cloud Storage (Direct Upload)        │
                    │  via Presigned PUT URL                        │
                    │  Bucket: repl-default-bucket-*                │
                    └──────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────────────┐
                    │  Confirm Upload → Create Asset → Queue Job   │
                    └──────────────────────────────────────────────┘
```

### Key Changes

| Aspect | Before (Local Disk) | After (Object Storage) |
|--------|---------------------|------------------------|
| Upload Target | Express server (/api/upload) | Direct to GCS via presigned URL |
| File Storage | /uploads/* on local disk | GCS bucket (repl-default-bucket-*) |
| Durability | Best-effort, files could vanish | 99.999999999% (11 nines) durability |
| Scalability | Single server | Unlimited concurrent uploads |
| Memory Usage | Full file buffered in memory | Zero memory usage for uploads |
| Data Transfer | File → Server → Disk | File → GCS (bypasses server) |

### New Files Added

| File | Purpose |
|------|---------|
| `server/replit_integrations/object_storage/index.ts` | Module exports |
| `server/replit_integrations/object_storage/objectStorage.ts` | GCS client, presigned URL generation |
| `server/replit_integrations/object_storage/objectAcl.ts` | Access control list utilities |
| `server/replit_integrations/object_storage/routes.ts` | Upload request URL endpoint |
| `client/src/components/ObjectUploader.tsx` | Uppy v5-based upload UI |
| `client/src/hooks/use-upload.ts` | Upload state management hook |

### Environment Variables

```bash
DEFAULT_OBJECT_STORAGE_BUCKET_ID  # GCS bucket ID
PUBLIC_OBJECT_SEARCH_PATHS        # Paths for public assets
PRIVATE_OBJECT_DIR                # Directory for private uploads
```

### Upload Flow (Two-Step Presigned URL)

```typescript
// Step 1: Request presigned URL (send JSON metadata, NOT the file)
const response = await fetch("/api/uploads/request-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: file.name,
    size: file.size,
    contentType: file.type,
  }),
});
const { uploadURL, objectPath } = await response.json();

// Step 2: Upload file directly to GCS (NOT to your backend)
await fetch(uploadURL, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});
```

### Cost Analysis

| Scale | Monthly Storage | Est. Cost |
|-------|----------------|-----------|
| 0 users | 0 GB | $0 |
| 100 users | ~5 GB | ~$4 |
| 1,000 users | ~50 GB | ~$40 |
| 10,000 users | ~500 GB | ~$400 |

**Cost breakdown:**
- Storage: ~$0.02/GB/month
- Operations: ~$0.004 per 10,000 operations
- Egress: Free within GCP/Replit

### Benefits

1. **Zero data loss** - Files stored in enterprise-grade cloud storage
2. **Scalability** - Handles 1000+ concurrent uploads without server strain
3. **Performance** - Direct upload bypasses server, reducing latency
4. **Cost efficiency** - Pay only for what you use
5. **Durability** - 99.999999999% durability (11 nines)

### Migration Notes

- Original Multer-based upload endpoint (`POST /api/upload`) remains functional for backward compatibility
- New presigned URL flow is recommended for all new integrations
- Existing files in `/uploads/*` continue to work
- Future enhancement: Migrate existing local files to Object Storage

---

*Last Updated: January 2026*
