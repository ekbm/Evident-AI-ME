# Evident - Design Guidelines

## Design Approach: Functional Design System

**Selected System**: Material Design principles adapted for a lightweight server-rendered MVP
**Justification**: Evident is a utility-focused tool where clarity, data presentation, and workflow efficiency are paramount. Users need to quickly upload files, ask questions, and review structured evidence with citations.

---

## Core Design Elements

### A. Typography
**Font Family**: Google Fonts - Inter (primary), Roboto Mono (code/citations)

**Hierarchy**:
- Page Title: 2.5rem (40px), font-weight: 700
- Section Headers: 1.5rem (24px), font-weight: 600
- Body Text: 1rem (16px), font-weight: 400, line-height: 1.6
- Citations/Metadata: 0.875rem (14px), font-weight: 500
- Labels: 0.75rem (12px), font-weight: 600, uppercase, letter-spacing: 0.05em

### B. Layout System
**Container**: max-w-7xl, centered with px-6
**Spacing Primitives**: Use Tailwind units of **2, 4, 8, 12, 16** (e.g., p-4, gap-8, mb-12)
**Grid**: 12-column responsive grid for main layout

**Page Structure**:
```
Single-page application layout:
- Header (fixed): Logo + status indicator, h-16
- Main Content (3-column grid on desktop, stacked mobile):
  - Left Panel (30%): Upload section
  - Center Panel (45%): Chat/Q&A interface
  - Right Panel (25%): Actions + citations sidebar
- All panels: bg surface with subtle border, rounded-lg, p-8
```

### C. Component Library

**Upload Section**:
- Drag-drop zone: min-h-48, dashed border-2, rounded-lg, p-8
- File info card: compact horizontal layout showing filename, size, status badge
- Status badges: pill-shaped (px-3 py-1, rounded-full, text-xs, font-semibold)

**Chat Interface**:
- Question input: textarea with rounded-lg, p-4, border-2, min-h-24
- Ask button: prominent, rounded-lg, px-6 py-3, font-semibold
- Message list: space-y-6, each message in card with rounded-lg, p-6
  - Question: lighter treatment, text-sm
  - Answer: prominent, font-normal, mb-4
  - Evidence preview: bg-muted, p-4, rounded, border-l-4, space-y-2

**Citations Display**:
- Compact list with numbered badges [1], [2], etc.
- Each citation: rounded-md, p-3, border-l-2, mb-2
- Source reference: Roboto Mono, text-xs
- Similarity score: text-xs, opacity-75

**Obligations Checklist**:
- Extract button: secondary style, w-full, py-3, rounded-lg
- Checklist items: space-y-3
  - Checkbox (non-interactive, visual only for MVP)
  - Item card: p-4, rounded-lg, border
  - Fields displayed as definition list (dt/dd pairs):
    - Who: font-semibold, mb-1
    - Must do: text-sm, mb-2
    - When: text-xs, italic
    - Source: text-xs, Roboto Mono, opacity-75

**Status Indicators**:
- Processing: pulsing animation on badge
- Ready: checkmark icon
- Error: alert icon
- File type icons: use Heroicons (document, photo, microphone, video)

### D. Component Spacing & Rhythm
- Cards: p-6 to p-8
- Sections: mb-12 between major sections, mb-6 between subsections
- Form fields: mb-4
- Buttons: px-6 py-3 for primary, px-4 py-2 for secondary
- Lists: space-y-3 for compact items, space-y-6 for chat messages

### E. Interaction States
**Buttons**:
- Default: solid with subtle shadow
- Hover: slight lift (shadow-md)
- Active: pressed appearance (shadow-sm)
- Disabled: reduced opacity (0.5), cursor-not-allowed

**Form Inputs**:
- Default: border-2
- Focus: border width unchanged, add focus ring (ring-2, ring-offset-2)
- Error: border treatment, small error text below (text-xs, mt-1)

---

## Images
**No hero image required** for this utility application. 

**Icon Usage**:
- Use Heroicons throughout via CDN
- Document icon for files, chat-bubble for questions, clipboard-check for obligations
- File type specific icons in upload section
- Include in status badges where appropriate

---

## Responsive Behavior
- Desktop (lg+): 3-column layout as described
- Tablet (md): 2-column (upload + chat stacked, citations/actions in sidebar)
- Mobile (base): Single column, full-width sections with mb-8 spacing

---

## Accessibility
- All form inputs with visible labels (not just placeholders)
- Focus indicators on all interactive elements (ring-2 ring-offset-2)
- ARIA labels for icon-only buttons
- Minimum touch target: 44x44px on mobile
- Semantic HTML: proper heading hierarchy, main/section/article elements