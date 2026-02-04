# COCAD Feature Checklist

**Rating Scale:**
- 1 = Need to make this (doesn't exist)
- 2 = Exists but broken/ugly/incomplete
- 3 = Works but needs polish
- 4 = Good, minor tweaks needed
- 5 = Production ready, Apple-quality

**Last Updated:** 2026-02-04

---

## Core AI / Backend (12 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 1 | Groq API integration working | 2 | Switched to Groq, needs end-to-end test |
| 2 | Plan generation produces valid JSON | 2 | Groq wired, untested |
| 3 | Action sequence generation is accurate | 2 | Prompt updated, untested |
| 4 | AI asks clarifying questions before starting | 2 | Clarify endpoint/UI added, untested |
| 5 | AI can request specific camera angles | 1 | Not implemented |
| 6 | AI analyzes screenshots to verify part | 2 | Verify API added, vision unconfirmed |
| 7 | AI proposes "done" based on visual check | 2 | Verification UI added, untested |
| 8 | AI suggests fixes when part looks wrong | 2 | Suggested fixes wired, untested |
| 9 | Prompt keeps model focused (not confused) | 2 | Prompts exist but not optimized |
| 10 | Error messages from AI are helpful | 1 | Generic errors only |
| 11 | Backend handles malformed AI responses | 2 | Basic JSON parsing, no recovery |
| 12 | API response times are acceptable (<5s) | 1 | Untested with Groq |

---

## Sidebar UI (10 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 13 | Sidebar appears reliably on Onshape | 3 | Works, sometimes slow |
| 14 | Sidebar matches Onshape dark theme | 3 | Close but not pixel-perfect |
| 15 | Sidebar toggle works (show/hide) | 3 | Works, animation could be smoother |
| 16 | Onshape viewport isn't covered | 3 | Works with margin, edge cases? |
| 17 | Chat input feels responsive | 2 | Basic textarea, no polish |
| 18 | Loading animation while thinking | 2 | Spinner exists, not refined |
| 19 | Progress view shows clear steps | 2 | Exists but untested |
| 20 | Error states are clear and actionable | 2 | Basic error display |
| 21 | Success state feels rewarding | 2 | Basic checkmark |
| 22 | Scrolling behavior is smooth | 2 | Untested with long content |

---

## Conversation / Chat (8 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 23 | User can type natural language | 3 | Works |
| 24 | AI responds conversationally | 2 | Clarify flow added, untested |
| 25 | AI asks clarifying questions upfront | 2 | Clarify endpoint/UI added |
| 26 | User can interrupt/redirect mid-generation | 1 | Not implemented |
| 27 | Chat history is preserved in session | 2 | In-memory conversation state |
| 28 | User can say "change X to Y" | 1 | No modification support |
| 29 | AI confirms understanding before acting | 2 | Clarify flow before plan |
| 30 | Conversation doesn't feel robotic | 1 | Needs tuning |

---

## Part Generation (10 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 31 | Simple box generates correctly | 1 | Untested end-to-end |
| 32 | Simple cylinder generates correctly | 1 | Untested |
| 33 | Box with center hole | 2 | Hole actions wired, untested |
| 34 | Box with corner holes (4x) | 2 | Hole actions wired, untested |
| 35 | Fillet on edges | 2 | Fillet actions wired, untested |
| 36 | Chamfer on edges | 2 | Chamfer actions wired, untested |
| 37 | L-bracket (multiple sketches) | 1 | Not implemented |
| 38 | Variable Studio populated correctly | 2 | Logic exists, untested |
| 39 | Dimensions reference variables | 2 | Logic exists, untested |
| 40 | Feature tree looks clean | 1 | No verification |

---

## Visual Verification (6 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 41 | Can rotate viewport programmatically | 2 | Rotation helper added, untested |
| 42 | Can take screenshot of viewport | 2 | Capture helper added, untested |
| 43 | Captures 8 angles (4 top, 4 bottom) | 2 | 8-angle capture wired |
| 44 | AI can request specific angles | 1 | Not implemented |
| 45 | Screenshots sent to AI for analysis | 2 | Verify API wired, untested |
| 46 | Loop continues until AI satisfied | 2 | Verification loop added, untested |

---

## Automation Engine (8 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 47 | Selectors find Onshape elements | 2 | Guessed, needs validation |
| 48 | Click actions work reliably | 2 | Logic exists, untested |
| 49 | Keyboard input works (type values) | 2 | Actions wired, untested |
| 50 | Tab/Enter navigation works | 2 | PRESS_KEY wired, untested |
| 51 | Wait-for-element is reliable | 2 | Basic polling exists |
| 52 | Actions have visual feedback | 2 | Highlight/tooltip exists |
| 53 | Retry logic on failure | 2 | Retry added, untested |
| 54 | Can pause/resume automation | 2 | Pause/resume wired, untested |

---

## Error Handling (5 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 55 | Element-not-found shows helpful message | 2 | Error includes step/action |
| 56 | Network errors handled gracefully | 2 | Basic try/catch |
| 57 | User can retry failed step | 1 | Not implemented |
| 58 | Logs are useful for debugging | 2 | Console.log exists |
| 59 | Recovery from partial failure | 1 | No recovery |

---

## Settings / Configuration (4 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 60 | Settings panel exists | 2 | UI added, untested |
| 61 | Can configure default units (mm/in) | 2 | Settings wired, untested |
| 62 | Can adjust automation speed | 2 | Settings wired, untested |
| 63 | Settings persist across sessions | 2 | Stored in chrome.storage |

---

## Polish / UX (7 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 64 | Animations are smooth, not janky | 2 | Basic CSS transitions |
| 65 | Typography is consistent | 3 | Uses system fonts |
| 66 | Spacing/padding is consistent | 3 | Tailwind helps |
| 67 | No visual bugs on different screen sizes | 1 | Untested |
| 68 | Extension icon looks good | 2 | SVG placeholder |
| 69 | Doesn't feel like "AI slop" | 2 | Needs personality |
| 70 | Feels fast and responsive | 2 | Untested at scale |

---

## Keyboard & Shortcuts (5 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 71 | Ctrl+Enter submits prompt | 1 | Not implemented |
| 72 | Escape cancels/closes dialogs | 1 | Not implemented |
| 73 | Keyboard navigation in sidebar | 1 | Not implemented |
| 74 | Shortcut to toggle sidebar | 1 | Not implemented |
| 75 | Focus returns to input after action | 1 | Not implemented |

---

## Smart Features (8 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 76 | AI explains what it will do before starting | 1 | Not implemented |
| 77 | AI estimates complexity/time | 1 | Not implemented |
| 78 | AI warns about potentially tricky requests | 1 | Not implemented |
| 79 | AI suggests simpler alternatives | 1 | Not implemented |
| 80 | Recent prompts dropdown | 1 | Not implemented |
| 81 | Favorite/save prompts | 1 | Not implemented |
| 82 | Detects existing variables (no duplicates) | 1 | Not implemented |
| 83 | Works with existing features in document | 1 | Not implemented |

---

## Quality of Life (6 items)

| # | Feature | Rating | Notes |
|---|---------|--------|-------|
| 84 | Copy plan to clipboard | 1 | Not implemented |
| 85 | Export action log for debugging | 1 | Not implemented |
| 86 | "Watch mode" vs "Fast mode" toggle | 1 | Not implemented |
| 87 | Undo/rollback last operation | 1 | Not implemented (may need Onshape undo) |
| 88 | Clear chat / start fresh button | 1 | Not implemented |
| 89 | Confirmation before destructive actions | 1 | Not implemented |

---

## Summary

| Category | Items | Avg Rating | Target |
|----------|-------|------------|--------|
| Core AI / Backend | 12 | 1.75 | 5.0 |
| Sidebar UI | 10 | 2.40 | 5.0 |
| Conversation / Chat | 8 | 1.75 | 5.0 |
| Part Generation | 10 | 1.60 | 5.0 |
| Visual Verification | 6 | 1.83 | 5.0 |
| Automation Engine | 8 | 2.00 | 5.0 |
| Error Handling | 5 | 1.60 | 5.0 |
| Settings / Configuration | 4 | 2.00 | 5.0 |
| Polish / UX | 7 | 2.14 | 5.0 |
| Keyboard & Shortcuts | 5 | 1.00 | 5.0 |
| Smart Features | 8 | 1.00 | 5.0 |
| Quality of Life | 6 | 1.00 | 5.0 |
| **TOTAL** | **89** | **1.71** | **5.0** |

---

## Priority Order

**Phase 1: Core pipeline (must hit 3)**
- #1-3: Groq integration
- #31, #47-50: Simple box with keyboard input

**Phase 2: Conversation + verification (must hit 3)**
- #4, #24-30: Conversational AI
- #41-46: Visual verification loop

**Phase 3: Medium features (must hit 3)**
- #33-36: Holes, fillets, chamfers
- #76-79: Smart warnings and explanations

**Phase 4: Quality of life (must hit 3)**
- #71-75: Keyboard shortcuts
- #80-89: Recent prompts, watch mode, export

**Phase 5: Polish to 4+**
- #13-22: Sidebar UI refinement
- #55-59: Error handling
- #60-70: Settings and UX polish

**Phase 6: Final push to 5**
- Every single item. No exceptions.
- Test on fresh Onshape accounts
- Test edge cases ruthlessly
