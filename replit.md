# Evident - Evidence-Based Assistant

## Overview
Evident is a full-stack web application designed as an "any-file" evidence-based assistant. It allows users to upload various file types (documents, images, audio, video) and interact with them using Retrieval-Augmented Generation (RAG) with integrated citations. A key capability is extracting structured JSON checklists of obligations from legal and policy documents. The project also includes AI-readiness assessment tools, such as a dashboard and document scanner, and governance features like owner remediation workflows and policy enforcement for AI-generated answers. Evident targets enterprise AI deployments, offering features like Pilot Mode for controlled rollout, extensive integration capabilities, and future plans for iOS app integration and an advanced API for AI-to-AI consumption.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript and Vite.
- **UI/UX**: shadcn/ui (on Radix UI), Tailwind CSS with custom design tokens, Material Design principles, and Inter font family.
- **Post-Login Layout**: Features a three-tab layout: "Chat with Evi" (default, RAG-enabled AI assistant with conversation history and dynamic document selection), "Knowledge Space" (document management, mode switcher, workspace stats, mode-specific tools), and "Knowledge Health" (admin/granted access, unified AI readiness view with drill-down capabilities, inline fix actions, and bulk actions).
- **Smart Question Routing**: Routes questions based on document selection; uses platform/account handler if no documents are selected, otherwise searches selected documents via pgvector.
- **Mobile/iOS UI**: Optimized for iOS Safari and touch interactions with responsive design.
- **PWA Support**: Progressive Web App enabled with `manifest.json`, service worker (`sw.js`), and Android PWA install banner. 95% of users are on Android, so PWA install is the primary mobile strategy. iOS users get the native App Store banner (ID: 6758041735).
- **"Get the App" Sections**: Android-first app promotion on all landing pages via `GetTheAppSection` component. Uses browser `beforeinstallprompt` API for one-tap PWA install on Android, App Store link for iOS, and desktop install fallback.

### Technical Implementations
- **Backend**: Node.js with Express and TypeScript, using a RESTful JSON API.
- **Data Storage**: PostgreSQL (Neon-backed) for all application data; Replit Object Storage (GCS-backed) for file storage. Legacy SQLite is not persistent and is no longer used for new tables.
- **AI Integration**: Leverages OpenAI API for embeddings, Q&A, obligation extraction, transcription, and image OCR/captioning.
- **File Processing Microservice**: A Python microservice handles advanced document processing (PDF, tables, intelligent OCR) with extended timeouts.
- **Auto-Prep Pipeline**: Automatically queues a `DOCUMENT_PREP` job after file ingestion, including OCR, table recovery, text cleanup, structure reconstruction, normalization, and metadata enrichment.
- **Readiness Scoring**: Knowledge Health uses a single PostgreSQL source of truth, joining `pg_assets` with `pg_document_readiness_scans` for workspace-level and per-document stats. Scoring considers extractability, structure, quality, and metadata.
- **Vector Search**: Implemented using `pgvector` extension in PostgreSQL with HNSW indexing for high-performance similarity search.
- **Content Protection**: Multi-layer system including content moderation, prompt injection detection, answer quality validation, source verification, and audit logging.
- **Mode-Isolated Chat Architecture**: Supports distinct processing paths for various intent modes to prevent interference and ensure extensibility.
- **Auto-Refresh System**: Client-side polling of a `/api/version` endpoint for silent application reloads on new deployments.
- **Authentication**: Primary sign-in via email verification code (passwordless).
- **Onboarding Tour**: A 3-step spotlight overlay for first-time users, persisted via local storage.
- **Study Journey**: Tracks document progress through defined stages with associated metrics.
- **Exam Countdown**: Provides phase-based study recommendations based on user-set exam dates.
- **Session Analytics**: Tracks user behavior events for study-related activities for admin analysis.
- **User Insights Dashboard**: Admin interface for monitoring user signup, engagement, and mode usage.
- **Stability & Self-Healing**: Includes server-side rate limiting, auth guards, global 401 error handling with backoff, and request timeouts.
- **Performance & Response Cache**: Server-side in-memory cache for expensive endpoints and frontend query optimizations to reduce database load.

### Feature Specifications
- **Document Source Tracking**: `pg_assets.source` field tracks document origin (`upload`, `google_drive`, `sharepoint`, `onedrive`, `dropbox`, `email`). Source icons (upload arrow for uploaded, plug for external) shown in Selected Documents box and document list. Ready for future connector integrations.
- **Core Capabilities**: Selected Documents Box, AI Readiness Dashboard & Document Scanner, Governance (Remediation Workflow, Policy Readiness Gate).
- **Enterprise Features**: Pilot Mode, Integration API Layer, Enterprise Agent, Org Admin Console (multi-tenancy, RBAC, auditing), dedicated Enterprise Documents tab, Prepared Document Versioning. Knowledge Health tab includes inline metadata fix actions and batch prepare functionality.
- **Enterprise Connector Architecture (Future)**: "Process & Index, Don't Store Originals" pattern for external sources like SharePoint, Google Drive, and on-premise agents. **Sync strategy**: Manual sync (always available) + optional scheduled daily sync for all users. Real-time webhook sync available as a premium enterprise add-on at higher pricing. Source documents have same query speed as uploaded documents once processed; only storage cost is lower (no original file stored). Re-processing cost applies when source documents are updated.
- **Selected Documents Box**: Extracted as standalone `SelectedDocumentsBox` component (`client/src/components/selected-documents-box.tsx`), placed at top of desktop Knowledge Space. Mobile uses expandable inline view with source icons. Shared selection state across Chat and Knowledge Space tabs. Source-agnostic design ready for multi-source document selection.
- **User-Owned Storage Architecture (Future)**: Targeting **consumers** (students, freelancers, small business owners, individuals) who lack enterprise document management tools and have documents scattered across emails, phone folders, and multiple cloud drives. When connecting a cloud drive (Google Drive, OneDrive, Dropbox, Box, iCloud), Evident asks if the user wants to store originals in their own drive. If yes, originals go to a designated folder (e.g., "Evident Documents") in the user's drive; Evident only keeps lightweight processed data (text chunks + AI embeddings). Evident becomes their personal document organizer and AI search brain. One OAuth app registration per cloud provider covers all users (free setup).
- **Evident Mailbox (Future)**: Unique email address per user for forwarding emails — Evident processes attachments into searchable documents instantly, solving the pain of hunting through email threads. If user-owned storage is enabled, originals save to their connected drive.
- **AI Enhancements**: Post-Answer Action Engine, Agentic Document Understanding System (tool selection via OpenAI Function Calling), Smart Intent Detection.
- **User Management**: Early Access Free Tier Limits System, System Metrics & Monitoring, Document Folder Organization.
- **Specialized AI**: Intelligence Packs System for industry/function-specific AI capabilities.
- **Graduate CV Builder**: Multi-step workflow for generating and tailoring professional CVs from uploaded documents.
- **Learning System**: "Research Mode" for combining content with external research, "My Learning" page, and "Help Evi Learn" for community contributions.
- **Blog Feature**: Integrated blog with CRUD API and Markdown support.
- **Coupon Code System**: Database-driven coupon management.
- **Vertical Landing Pages & Mode System**: Tailored landing pages and persistent mode management for different user verticals.

## External Dependencies

- **OpenAI API**: AI model interactions (chat, embeddings, vision, transcription).
- **PostgreSQL**: Primary application database.
- **Stripe**: Subscription billing and payment processing.
- **Apple StoreKit 2**: iOS in-app purchases and JWS signature verification.
- **Replit Object Storage**: File storage.
- **Financial Datasets API**: SEC filings.
- **CoinGecko API**: Cryptocurrency price data.
- **Perplexity API**: Web research and real-time market news context.