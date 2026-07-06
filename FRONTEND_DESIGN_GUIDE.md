# Clinical Workflows Frontend Design Guide

## Design Philosophy

This redesign prioritizes **clarity, professionalism, and clinical efficiency**. The interface should feel like a premium medical decision-support tool, not an AI chatbot. Every element serves a purpose: reducing cognitive load, surfacing critical information, and enabling quick clinical decisions.

---

## Color Palette

### Primary Colors

| Color | Hex | Usage | Psychology |
|-------|-----|-------|------------|
| **Medical Blue** | `#0066CC` | Primary actions, links, highlights | Trust, professionalism, medical authority |
| **Clinical Green** | `#10B981` | Success states, positive indicators | Health, growth, safety |
| **Alert Orange** | `#F59E0B` | Warnings, cautions | Attention without alarm |
| **Alert Red** | `#EF4444` | Critical alerts, refusals | Danger, stop, critical action |
| **Neutral Gray** | `#6B7280` | Secondary text, borders | Hierarchy, de-emphasis |

### Background Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **White** | `#FFFFFF` | Main content areas, cards |
| **Light Gray** | `#F9FAFB` | Sidebar, panels, subtle backgrounds |
| **Darker Gray** | `#F3F4F6` | Hover states, subtle dividers |

### Text Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Dark Charcoal** | `#1F2937` | Primary text, headings |
| **Medium Gray** | `#6B7280` | Secondary text, descriptions |
| **Light Gray** | `#9CA3AF` | Tertiary text, hints |

---

## Typography

### Font Family

- **Primary Font:** `Inter` (sans-serif) — Clean, modern, excellent readability
- **Monospace Font:** `Fira Code` — For code, chunk IDs, technical references

### Font Sizes & Weights

| Element | Size | Weight | Line Height |
|---------|------|--------|------------|
| **H1 (Page Title)** | 32px | 700 (Bold) | 1.2 |
| **H2 (Section Title)** | 24px | 600 (SemiBold) | 1.3 |
| **H3 (Subsection)** | 18px | 600 (SemiBold) | 1.4 |
| **Body Text** | 14px | 400 (Regular) | 1.6 |
| **Small Text** | 12px | 400 (Regular) | 1.5 |
| **Button Text** | 14px | 600 (SemiBold) | 1.4 |
| **Code/Monospace** | 12px | 400 (Regular) | 1.5 |

---

## Layout Architecture

### Three-Panel Layout

```
┌─────────────────────────────────────────────────────┐
│ Header (Logo, User Menu, Settings)                  │
├──────────────┬──────────────────┬──────────────────┤
│              │                  │                  │
│   LEFT       │    CENTER        │     RIGHT        │
│   PANEL      │    PANEL         │     PANEL        │
│              │                  │                  │
│ • History    │ • Chat Feed      │ • Citations      │
│ • New Chat   │ • Input Area     │ • Tool Trace     │
│ • Profiles   │                  │ • Safety Flags   │
│ • Settings   │                  │ • Knowledge Path │
│              │                  │                  │
└──────────────┴──────────────────┴──────────────────┘
```

### Left Panel (Sidebar)

- **Width:** 280px (collapsible to 60px on mobile)
- **Background:** Light Gray (`#F9FAFB`)
- **Border:** 1px solid `#E5E7EB`

**Contents:**
1. **Logo/Branding** (40px height)
   - Clinical Workflows logo
   - Tagline: "Evidence-Based Care Planning"

2. **New Chat Button** (48px height)
   - Full-width, Medical Blue background
   - Icon + Text: "New Chat"
   - Hover: Darker blue

3. **Chat History** (scrollable)
   - List of recent conversations
   - Truncated titles (max 25 chars)
   - Timestamps (relative: "2h ago")
   - Hover: Light background highlight
   - Active: Medical Blue left border

4. **User Profile Section** (bottom, 60px)
   - User avatar (40px circle)
   - Username and role badge
   - Dropdown menu: Profile, Settings, Logout

### Center Panel (Chat Area)

- **Background:** White
- **Padding:** 24px

**Contents:**
1. **Conversation Header** (if in conversation)
   - Title (editable)
   - Case selector (dropdown)
   - Mode selector (Patient/Clinician toggle)

2. **Chat Feed** (scrollable, grows to fill space)
   - User messages: Right-aligned, Medical Blue background
   - Assistant messages: Left-aligned, Light Gray background
   - Timestamps on hover
   - Markdown rendering for assistant responses

3. **Input Area** (sticky at bottom)
   - Textarea (auto-expanding, max 200px)
   - Send button (Medical Blue, right side)
   - Keyboard shortcut hint: "Cmd+Enter to send"
   - Character count (optional)

### Right Panel (Evidence & Context)

- **Width:** 320px (collapsible)
- **Background:** Light Gray (`#F9FAFB`)
- **Border:** 1px solid `#E5E7EB`

**Contents (Tabbed):**
1. **Citations Tab**
   - List of retrieved sources
   - Source title, page number, snippet
   - Link to source (if available)
   - Badge: "OKF" or "RAG"

2. **Tool Trace Tab**
   - List of tools invoked (Calculator, DB Lookup, Web Search)
   - Tool name, inputs, outputs
   - Execution time

3. **Safety Tab**
   - Safety flags (if any)
   - Refusal reason (if applicable)
   - Medical disclaimer

4. **Knowledge Path Tab**
   - Routing decision (OKF, RAG, OKF+RAG)
   - Concept matches (if OKF)
   - Confidence score

---

## Component Specifications

### Buttons

**Primary Button**
- Background: Medical Blue (`#0066CC`)
- Text: White
- Padding: 10px 16px
- Border Radius: 6px
- Font Weight: 600
- Hover: Darker blue (`#0052A3`)
- Active: Even darker (`#003D7A`)

**Secondary Button**
- Background: Light Gray (`#F3F4F6`)
- Text: Dark Charcoal
- Border: 1px solid `#D1D5DB`
- Padding: 10px 16px
- Border Radius: 6px
- Hover: Darker gray background

**Danger Button**
- Background: Alert Red (`#EF4444`)
- Text: White
- Hover: Darker red (`#DC2626`)

### Input Fields

- **Border:** 1px solid `#D1D5DB`
- **Border Radius:** 6px
- **Padding:** 10px 12px
- **Font Size:** 14px
- **Focus:** Blue border (`#0066CC`), subtle shadow
- **Placeholder:** Medium Gray (`#9CA3AF`)

### Cards

- **Background:** White
- **Border:** 1px solid `#E5E7EB`
- **Border Radius:** 8px
- **Padding:** 16px
- **Shadow:** Subtle (0 1px 3px rgba(0,0,0,0.1))
- **Hover:** Slightly darker shadow

### Badges

- **Background:** Light variant of primary color
- **Text:** Primary color
- **Padding:** 4px 8px
- **Border Radius:** 4px
- **Font Size:** 12px
- **Font Weight:** 600

**Badge Variants:**
- Success: Green background, green text
- Warning: Orange background, orange text
- Danger: Red background, red text
- Info: Blue background, blue text

### Dividers

- **Color:** `#E5E7EB`
- **Height:** 1px
- **Margin:** 16px 0

---

## Responsive Design

### Breakpoints

| Device | Width | Layout |
|--------|-------|--------|
| **Mobile** | < 768px | Single column (sidebar collapsed, center full-width, right panel hidden) |
| **Tablet** | 768px - 1024px | Two columns (sidebar + center, right panel hidden/drawer) |
| **Desktop** | > 1024px | Three columns (full layout) |

### Mobile Optimizations

- Sidebar collapses to icon-only (60px)
- Right panel becomes a drawer (slide from right)
- Chat input area optimized for touch (larger tap targets)
- Font sizes slightly increased for readability

---

## Interaction Patterns

### Chat Message Flow

1. User types in input area
2. Input area expands as text grows (max 200px)
3. User presses Cmd+Enter (or clicks Send)
4. User message appears immediately (optimistic update)
5. Loading indicator appears below user message
6. Assistant message streams in (if streaming enabled)
7. Citations and tool trace populate in right panel
8. Conversation title auto-updates (if new conversation)

### Conversation Switching

1. User clicks conversation in sidebar
2. Chat feed updates to show conversation history
3. Right panel clears (or shows last message's context)
4. Input area clears

### Authentication Flow

1. User clicks "Login" or "Sign Up"
2. Modal or dedicated page opens
3. User enters credentials
4. On success, redirect to chat interface
5. User profile appears in sidebar

---

## Accessibility

- **Color Contrast:** All text meets WCAG AA standards (4.5:1 minimum)
- **Focus Indicators:** Visible blue outline on all interactive elements
- **Keyboard Navigation:** Tab order follows visual flow
- **Screen Reader:** Semantic HTML, ARIA labels where needed
- **Font Sizes:** Minimum 14px for body text

---

## Animation & Transitions

- **Fade In/Out:** 200ms ease-in-out
- **Slide In/Out:** 300ms ease-out
- **Hover Effects:** 150ms ease-in
- **Message Appearance:** Fade in 200ms
- **Loading Spinner:** Smooth 1s rotation

---

## Dark Mode (Future Enhancement)

For future implementation, define dark mode colors:
- Background: `#0F172A`
- Surface: `#1E293B`
- Text: `#F1F5F9`
- Accent: `#38BDF8` (lighter blue for contrast)

---

## Implementation Priorities

1. **Phase 1:** Basic layout (3 panels), authentication UI, chat feed
2. **Phase 2:** Conversation history, sidebar, right panel tabs
3. **Phase 3:** Responsive design, mobile optimization
4. **Phase 4:** Animations, dark mode, advanced features

---

## Design References

- **Inspiration:** ChatGPT interface (clean, minimal), UpToDate (clinical context)
- **Medical UI Principles:** Clear hierarchy, high contrast, minimal distractions
- **Typography:** Inter font (modern, readable), consistent sizing scale
- **Color Psychology:** Blue (trust), Green (health), Orange/Red (alerts)

