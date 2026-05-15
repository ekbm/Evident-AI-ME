# Evident Mobile UI Redesign

## Design Philosophy
**Target Audience**: Young users who prefer clean, colorful, minimal interfaces
**Core Principle**: One clear action per screen, vibrant colors, large touch targets

---

## Color Palette (Vibrant & Modern)

### Primary Colors
| Name | Hex | Use Case |
|------|-----|----------|
| Electric Blue | #3B82F6 | Primary actions, Home |
| Vivid Purple | #8B5CF6 | Workspace, folders |
| Emerald Green | #10B981 | Success, Readiness |
| Coral Orange | #F97316 | Highlights, notifications |
| Rose Pink | #EC4899 | Accent, special features |

### Gradient Combinations
- **Home**: Blue to Purple gradient
- **Workspace**: Purple to Pink gradient
- **Readiness**: Green to Teal gradient
- **Ask Question**: Orange to Yellow gradient

---

## Screen-by-Screen Design

### 1. Home Screen (Simplified)
- Large "ASK ANYTHING" gradient button (Blue/Purple)
- "SCAN DOCUMENT" with camera icon (Orange gradient)
- 3 recent documents as colorful cards
- Minimal text, icon-first design

### 2. Ask Question Screen
- Full-width input area
- Big circular MIC, CAMERA, GO buttons
- Quick action chips: [Summarize] [Explain] [Compare] [Extract]

### 3. Answer Screen
- Large, readable answer text (18px minimum)
- Colorful citation pills
- Simple follow-up input at bottom

### 4. Workspace Screen
- Big folder cards with color coding
- Simple tap to open
- Swipe actions for delete/rename

### 5. Readiness Dashboard
- Big circular progress ring with score
- Simple checklist for next steps
- One primary action button

### 6. Menu Screen
- Personal greeting with avatar
- Large, tappable menu items with colorful icons

---

## Typography Scale (Mobile Only)

| Element | Size | Weight |
|---------|------|--------|
| Page Title | 28px | Bold |
| Section Header | 22px | Semi-bold |
| Body Text | 18px | Regular |
| Button Text | 18px | Semi-bold |
| Caption | 14px | Regular |
| Small Label | 12px | Medium |

---

## Touch Targets

- **Minimum button size**: 48x48px (Apple HIG recommendation)
- **Primary buttons**: 56px height, full-width
- **Icon buttons**: 48x48px with generous padding
- **List items**: 64px minimum height

---

## Animation & Feedback

- **Button press**: Scale down to 0.95, subtle shadow
- **Page transitions**: Smooth slide left/right
- **Loading**: Colorful skeleton shimmer
- **Success**: Confetti burst or checkmark animation

---

## Implementation Notes

### Component Structure
```
/components/mobile-simple/
  MobileHome.tsx
  MobileAsk.tsx
  MobileWorkspace.tsx
  MobileReadiness.tsx
  MobileMenu.tsx
```

### Conditional Rendering
```jsx
{isMobile ? <MobileHome /> : <DesktopHome />}
```

---

## Preview Page

Access the design preview at: `/mobile-preview`
This page is hidden and not linked from anywhere in the app.

---

## Phase Rollout

**Phase 1**: Home + Ask Question screens
**Phase 2**: Workspace + Document view
**Phase 3**: Readiness dashboard
**Phase 4**: Menu + Settings
