# Phase 2: Downloadable AI Readiness Agent

**Status:** Planning  
**Dependencies:** iOS App launch success, user adoption metrics  
**Target:** Enterprise trial deployment

---

## Overview

Build a downloadable desktop/CLI agent that performs deep, end-to-end AI readiness assessment locally. This extends the current quick scan (file metadata only) to include full content analysis, grammar checking, readability scoring, and AI suitability evaluation.

---

## Current State vs Phase 2 Target

| Capability | Current Quick Scan | Phase 2 Agent |
|------------|-------------------|---------------|
| File format detection | Yes | Yes |
| File size analysis | Yes | Yes |
| PDF scanned/encrypted detection | Yes | Yes |
| **Content quality analysis** | No | Yes |
| **Grammar/style checking** | No | Yes |
| **Readability scoring** | No | Yes |
| **Table complexity analysis** | No | Yes |
| **AI suitability scoring** | No | Yes |
| **Structure/formatting checks** | No | Yes |
| **Guided document preparation** | No | Yes |
| **Auto-fix common issues** | No | Yes (premium) |
| Runs locally (privacy-first) | Yes | Yes |
| No cloud AI calls required | Yes | Configurable |

---

## Document Preparation Assistant

A key monetization feature: the agent doesn't just analyze - it **helps users prepare** their documents for AI processing.

### Preparation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Preparation Flow                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SCAN          2. DIAGNOSE        3. PREPARE             │
│  ─────────────    ─────────────      ─────────────          │
│  Upload docs      Show issues        Guide fixes            │
│  Quick analysis   Explain why        Step-by-step           │
│  Score preview    Prioritize         Auto-fix (premium)     │
│                                                             │
│  [FREE]           [FREE]             [PAID PLANS]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Preparation Capabilities by Plan

| Capability | Free | Starter | Pro | Enterprise |
|------------|------|---------|-----|------------|
| Scan & diagnose issues | Yes | Yes | Yes | Yes |
| View recommendations | Yes | Yes | Yes | Yes |
| Step-by-step guidance | Limited | Yes | Yes | Yes |
| Auto-fix grammar/spelling | No | Yes | Yes | Yes |
| Auto-convert scanned PDFs (OCR) | No | No | Yes | Yes |
| Auto-flatten tables | No | No | Yes | Yes |
| Batch preparation | No | No | Yes | Yes |
| Export AI-ready versions | No | Yes | Yes | Yes |
| Custom preparation rules | No | No | No | Yes |

### Preparation Actions

| Issue Detected | User Guidance | Auto-Fix (Premium) |
|----------------|---------------|-------------------|
| Scanned PDF (no text) | "This PDF is image-based. Run OCR to extract text." | One-click OCR conversion |
| Grammar errors | "Found 12 grammar issues. Review suggested corrections." | Apply all fixes |
| Low readability | "Reading level is Grade 16. Consider simplifying." | Suggest rewrites |
| Complex tables | "Nested tables detected. Flatten for better AI processing." | Auto-flatten to CSV |
| Missing structure | "No headings found. Add section headers." | Suggest heading structure |
| Encryption | "PDF is password-protected. Remove protection first." | Guide to unlock |
| Large file | "File exceeds 10MB. Consider splitting." | Auto-split by section |

### Preparation API Endpoints

```python
# New preparation endpoints
POST /api/prepare-document
  - Input: { file_url, actions: ["ocr", "grammar", "flatten_tables"] }
  - Output: { prepared_file_url, changes_made[], before_score, after_score }

POST /api/suggest-fixes
  - Input: { file_url }
  - Output: { issues[], suggested_actions[], estimated_improvement }

POST /api/apply-fix
  - Input: { file_url, fix_type, options }
  - Output: { fixed_file_url, changes_applied }

POST /api/export-ai-ready
  - Input: { file_url, target_format: "txt" | "md" | "json" }
  - Output: { exported_file_url, metadata }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Evident Desktop Agent                          │
│         (Electron/Tauri or Python + GUI)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Orchestrator  │    │   Python Analysis Module        │ │
│  │   (Node.js)     │◄──►│                                 │ │
│  │                 │    │   - PyMuPDF (PDF extraction)    │ │
│  │   - Auth/Sync   │    │   - PaddleOCR (image text)      │ │
│  │   - Policy      │    │   - Camelot/Tabula (tables)     │ │
│  │   - Caching     │    │   - spaCy (NLP/structure)       │ │
│  │   - UI          │    │   - LanguageTool (grammar)      │ │
│  └─────────────────┘    │   - textstat (readability)      │ │
│                         │   - pandas (table profiling)    │ │
│                         └─────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Local Encrypted Cache │ Auto-Update │ Offline Mode        │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ (optional sync when online)
                    ▼
           ┌─────────────────┐
           │  Evident Cloud  │
           │  - Policies     │
           │  - Telemetry    │
           │  - Enterprise   │
           └─────────────────┘
```

---

## Tools & Libraries Required

### Python Analysis Module (extends existing service)

| Category | Library | Purpose | Size Impact |
|----------|---------|---------|-------------|
| PDF Extraction | PyMuPDF | Text/layout extraction | ~56MB |
| OCR | PaddleOCR | Image-based text | ~690MB |
| Tables | Camelot + Tabula | Table extraction | ~50MB |
| NLP/Structure | spaCy (en_core_web_sm) | Entity detection, structure | ~50MB |
| Grammar/Style | LanguageTool | Grammar, spelling, style | ~200MB |
| Readability | textstat | Flesch-Kincaid scores | <1MB |
| Formatting | python-docx, python-pptx | Document structure | ~10MB |
| Table Analysis | pandas + profiling | Complexity metrics | ~50MB |

**Total estimated size:** ~1.1GB (can be reduced with selective packaging)

### Optional: Local LLM Support

| Option | Use Case |
|--------|----------|
| Ollama | Fully offline AI critique (enterprise) |
| OpenAI API | Cloud-based when permitted |
| Azure OpenAI | Enterprise compliance |

---

## Enhanced API Endpoints

Extend existing Python microservice with new endpoints:

```python
# Existing endpoints (keep as-is)
POST /api/extract-pdf      # PDF text extraction
POST /api/extract-tables   # Table extraction  
POST /api/ocr              # OCR text from images
POST /api/analyze-document # Full document analysis

# New Phase 2 endpoints
POST /api/analyze-content-quality
  - Input: { file_url, options }
  - Output: { completeness_score, structure_score, issues[], recommendations[] }

POST /api/assess-readability  
  - Input: { text or file_url }
  - Output: { flesch_score, grade_level, complexity_rating, suggestions[] }

POST /api/check-grammar
  - Input: { text or file_url }
  - Output: { error_count, issues[], corrected_text }

POST /api/evaluate-table-complexity
  - Input: { file_url }
  - Output: { table_count, complexity_scores[], nested_tables, merged_cells }

POST /api/compute-ai-suitability
  - Input: { file_url }
  - Output: { overall_score, breakdown{}, recommendations[], ready_for_ai: boolean }
```

---

## Agentic Tool Selection (OpenAI Function Calling)

Extend current agentic system with new tools:

```javascript
const phase2Tools = [
  // Existing tools
  { name: "analyze_layout", description: "Extract document layout and structure" },
  { name: "extract_tables", description: "Extract tabular data from documents" },
  { name: "ocr_text", description: "OCR text from scanned/image documents" },
  
  // New Phase 2 tools
  { name: "analyze_formatting", description: "Check structure consistency, headers, styling" },
  { name: "assess_readability", description: "Calculate Flesch-Kincaid and grade level scores" },
  { name: "check_grammar", description: "Detect grammar, spelling, and style issues" },
  { name: "evaluate_tables", description: "Analyze table complexity and AI-compatibility" },
  { name: "score_ai_suitability", description: "Compute overall AI-readiness rating" }
];
```

---

## Scoring Rubric

### Overall AI Readiness Score (0-100)

| Metric | Weight | Description |
|--------|--------|-------------|
| Content Completeness | 25% | Sections present, depth of content, topic coverage |
| Structural Integrity | 20% | Proper headers, consistent formatting, logical layout |
| Linguistic Clarity | 20% | Grammar correctness, readability score, style consistency |
| Table Complexity | 15% | Simple vs nested tables, merged cells, data quality |
| AI Suitability | 20% | Text extractability, encoding, special characters, length |

### Status Thresholds

| Score Range | Status | Meaning |
|-------------|--------|---------|
| 80-100 | AI Ready | Document can be processed by AI with high confidence |
| 60-79 | Needs Prep | Minor issues to address before AI processing |
| 40-59 | Significant Work | Multiple issues requiring attention |
| 0-39 | Manual Review | Document needs significant manual intervention |

---

## Desktop Agent Features

### Core Functionality
- Drag-and-drop file/folder analysis
- Batch processing with progress tracking
- Detailed per-file reports with recommendations
- Export reports (PDF, Excel, JSON)
- Offline mode with local caching

### Enterprise Features
- Policy sync from Evident Cloud
- Configurable scoring rubrics
- Telemetry controls (opt-in/opt-out)
- SSO/SAML authentication
- Audit logging
- Auto-update with enterprise approval workflow

### Privacy Controls
- All processing local by default
- Optional cloud sync for enterprise management
- No file content sent to cloud (only metadata/scores)
- Encrypted local cache
- Configurable data retention

---

## Packaging Options

| Platform | Technology | Installer |
|----------|------------|-----------|
| Windows | Electron or Tauri | MSI, MSIX |
| macOS | Electron or Tauri | PKG, DMG |
| Linux | AppImage or Flatpak | AppImage |
| CLI Only | Python (PyInstaller) | pip install |

---

## Development Phases

### Phase 2.1: Python Module Enhancement
- [ ] Integrate spaCy for structure analysis
- [ ] Add LanguageTool for grammar checking
- [ ] Implement textstat readability scoring
- [ ] Build table complexity analyzer
- [ ] Create unified scoring engine
- [ ] Add new API endpoints
- [ ] Benchmark performance

### Phase 2.2: Agent Orchestrator
- [ ] Build Node.js orchestrator
- [ ] Implement file watcher/processor
- [ ] Add caching layer
- [ ] Create authentication flow
- [ ] Build offline queue

### Phase 2.3: Desktop UI
- [ ] Choose framework (Electron vs Tauri)
- [ ] Design UI/UX
- [ ] Implement drag-and-drop
- [ ] Build report viewer
- [ ] Add export functionality

### Phase 2.4: Enterprise Features
- [ ] Policy sync engine
- [ ] Telemetry system
- [ ] Auto-update mechanism
- [ ] Enterprise installer packaging
- [ ] Documentation

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Analysis accuracy vs manual review | >90% agreement |
| Processing speed (per document) | <30 seconds |
| Enterprise adoption | 5+ pilot customers |
| User satisfaction (NPS) | >50 |

---

## Dependencies & Triggers

This phase depends on:
1. **iOS App Success** - User adoption and revenue metrics
2. **Enterprise Interest** - At least 3 enterprise inquiries
3. **Resource Availability** - Development capacity

**Decision Point:** Review after iOS app has 1000+ active users or first enterprise contract signed.

---

## Cost Considerations

| Item | Estimated Cost |
|------|----------------|
| LanguageTool hosting (if cloud) | $0-50/month |
| OpenAI API (optional) | Usage-based |
| Code signing certificates | $200-400/year |
| Auto-update infrastructure | $20-50/month |
| Development time | 4-8 weeks |

---

*Document created: January 2026*  
*Last updated: January 2026*
