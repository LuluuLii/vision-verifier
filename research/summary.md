Research Findings Summary
2.1 UI Representation (research/01-ui-representation.md)

Key findings from research:

Three representation modalities — with empirical evidence that hybrid is
best:
- Structural (DOM/Accessibility Tree): Best token-efficiency. Accessibility
tree benchmarks at ~85% task success vs ~50% for vision-only.
- Visual (Screenshots): Catches visual-only issues (colors, layout, images)
that DOM misses. SoM annotations improve grounding.
- Hybrid (Both): Outperforms single-modality across all major benchmarks
(Mind2Web, WebArena, ScreenSpot).

Accessibility tree is the recommended primary representation:
- Semantic roles (button, link, textbox) are exactly the vocabulary agents
need
- Compact — strips visual-only elements
- State-aware — checked, expanded, disabled, focused
- Playwright API: page.accessibility.snapshot() and newer ariaSnapshot()
- CDP: Accessibility.getFullAXTree() for full detail with bounding boxes

DOM simplification is mandatory for LLM consumption:
- Raw DOM: 2,000-10,000+ nodes, massive token cost
- Proven pruning: strip class/style/data-*, remove script/style/hidden,
flatten wrapper divs
- Element indexing (numbered lists) is the most effective action-grounding
format for LLMs
- Used by browser-use, WebArena, Vercel agent-browser

Visual structure ≠ DOM structure — important for evaluation:
- Positioned elements break flow, flex/grid reorder visually
- Pseudo-elements are visual but not in DOM
- Shadow DOM is partially opaque
- Need bounding box extraction + spatial analysis to get true visual layout
- Recommended: a11y tree + bounding boxes = semantic + spatial in one pass

Emerging standards:
- Google A2UI (Dec 2025): Agent-to-User Interface, declarative JSON for
agent-generated UIs
- Vercel agent-browser: "Snapshot + Refs" system, 93% token reduction vs
traditional approaches

Key models for reference:
- ScreenAI (Google, 2024), Ferret-UI (Apple, 2024), CogAgent (2024),
Pix2Struct (Google, 2023)
- SeeClick, SeeAct, WebVoyager for web agent grounding
- Set-of-Mark (SoM) prompting for visual element referencing

2.2 Browser Automation (research/02-browser-automation.md)

Playwright is the clear choice for this project:
- Auto-wait mechanism (critical for agents)
- Accessibility tree snapshots (token-efficient)
- CDP access when needed via newCDPSession()
- Multi-browser support
- page.route() for request interception

Screenshot stability — the composite wait strategy:
Sources of instability: font loading (FOUT), image loading, CSS animations,
loading states, third-party content, cursor blinking, sub-pixel rendering.

Production-grade stability requires combining:
1. waitForLoadState('networkidle') (with timeout)
2. document.fonts.ready
3. All images complete
4. No aria-busy="true" / spinner / skeleton elements
5. emulateMedia({ reducedMotion: 'reduce' })
6. Force-disable animations via injected CSS
7. DOM mutation stability (no changes for 300ms)
8. No layout shifts for 500ms

Authentication: Use storageState for session persistence. Pre-authenticated
contexts avoid CAPTCHA entirely.

SPA handling: waitForURL(), waitForResponse(), DOM stability detection (not
waitForNavigation()).

Observation/action loop best practices (2025):
WAIT → OBSERVE (a11y tree + screenshot) → COMPRESS → DECIDE (LLM) → ACT
(element ref) → VERIFY → REPEAT
Token budget management is the #1 practical concern.

2.3 UI Evaluation (research/03-ui-evaluation.md)

Visual Regression Testing — tool landscape:





┌─────────────────────┬────────────────┬──────────┬────────┬────────────────
──────┐
│        Tool         │  Diff Method   │ AI-Based │ Open   │       Best For
      │
│                     │                │          │ Source │
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│ Playwright          │ Pixel          │ No       │ Yes    │
General-purpose,     │
│ toHaveScreenshot()  │                │          │        │ free
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│ Chromatic           │ Pixel +        │ No       │ No     │ Storybook
projects   │
│                     │ stabilization  │          │        │
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│                     │ Visual AI      │          │        │ Lowest false
      │
│ Applitools Eyes     │ (CNN)          │ Yes      │ No     │ positives,
layout    │
│                     │                │          │        │ mode unique
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│ Percy               │ Pixel +        │ No       │ No     │ Cross-browser
      │
│                     │ threshold      │          │        │
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│ Lost Pixel          │ Pixel          │ No       │ Yes    │ Self-hosted,
free    │
│                     │ (pixelmatch)   │          │        │
      │
├─────────────────────┼────────────────┼──────────┼────────┼────────────────
──────┤
│ Meticulous AI       │ AI             │ Yes      │ No     │ Zero test
authoring  │
│                     │ record/replay  │          │        │
      │
└─────────────────────┴────────────────┴──────────┴────────┴────────────────
──────┘










VLM-based evaluation — what works and what doesn't:
- Works well (~90%): Major layout assessment, overlapping elements, broken
layouts, missing content
- Works well (~95%): Content verification, text reading, label checking
- Does NOT work reliably: Pixel-precise spacing (<30%), exact color matching
(~60%), subtle alignment (<30%)
- Cost: ~$0.01-0.03 per screenshot, 2-5s latency
- Best used as coarse filter, not precision tool

Programmatic checks — production-ready today:
- Layout anomaly detection: getBoundingClientRect() pairwise overlap,
scrollWidth > clientWidth overflow, viewport boundary violations
- Spacing/alignment: Compare computed styles against design token sets, grid
alignment checks
- Accessibility: axe-core (57% WCAG coverage), Lighthouse, IBM Equal Access
- CSS anomalies: Stylelint, z-index audit, off-token value detection

UI Aesthetics — research landscape:
- Academic metrics: visual complexity, visual balance, color harmony, grid
conformity, white space ratio
- UICrit (Berkeley, UIST 2024): LLM-generated design critiques dataset
- UIClip (CMU, 2024): CLIP-based UI quality scoring model
- No production tool exists for aesthetic scoring — all research-only
- Closest practical approximation: design system token compliance checking

Functional correctness — layered approach:
- Testing Library: behavioral testing (query by role/label, assert visible
output)
- Playwright Component Testing: real browser rendering + behavioral
assertions + visual screenshots
- Model-based testing (XState): auto-generate test paths from state machines
- Property-based testing (fast-check): define invariants, generate random
inputs

2.4 Agent Architecture (research/04-agent-architecture.md)

Relevant patterns:
- ReAct: Observe → Reason → Act loop. Simple, widely used.
- Plan-Execute-Reflect: Multi-step planning with self-correction. Better for
complex tasks.
- Hierarchical: Planner decomposes into subtasks → specialists execute →
planner reviews.

For UI verification specifically:
- Verification coordinator selects appropriate layer (static analysis vs
snapshot vs interaction vs E2E)
- Each layer has its own observation/evaluation pipeline
- Results feed back to coordinator for overall pass/fail decision
- AI evaluation (VLM) is optional layer on top of programmatic checks

---
Part 3: Overall Framework Architecture

Module Map (from idea.md, refined by research)

┌─────────────────────────────────────────────────────────────────┐
│                    Vision Verifier Framework                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  UI Extractor │  │   Executor   │  │   Observer   │           │
│  │  (Module 1)   │  │  (Module 3)  │  │  (Module 4)  │           │
│  │              │  │              │  │              │           │
│  │ - DOM tree    │  │ - Playwright │  │ - Screenshot │           │
│  │ - A11y tree   │  │ - CDP        │  │ - DOM diff   │           │
│  │ - Layout info │  │ - Actions    │  │ - Perf trace │           │
│  │ - UI graph    │  │ - Auth/state │  │ - Stability  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         └────────────┬────┴────────────┬────┘                    │
│                      │                 │                         │
│              ┌───────▼───────┐ ┌───────▼───────┐                │
│              │  Evaluator    │ │ Agent Planner  │                │
│              │  (Module 5)   │ │  (Module 2)    │                │
│              │               │ │               │                │
│              │ - Layout check│ │ - ReAct loop  │                │
│              │ - A11y check  │ │ - Verification│                │
│              │ - Visual diff │ │   coordinator │                │
│              │ - VLM eval    │ │ - Layer select│                │
│              │ - Aesthetics  │ │               │                │
│              └───────────────┘ └───────────────┘                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │              ui-fast-verify (Specialized Pipeline)      │      │
│  │  State injection → Vite render → Screenshot → Evaluate  │      │
│  │  (Optimized for dev-time speed: <500ms)                 │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘

How ui-fast-verify Fits

ui-fast-verify is a specialized fast path that shortcuts the full framework:
- Skips Executor (no browser navigation needed — state injection instead)
- Uses a simplified Observer (screenshot + DOM, no complex stability logic)
- Uses a subset of Evaluator (visual output, error capture, optional VLM)
- Doesn't need Agent Planner (deterministic render pipeline)

It's the right starting point for implementation because it validates the
core hypothesis (state injection + persistent renderer = fast verification)
with minimal module complexity.

The full framework builds on top of ui-fast-verify by adding:
- Full browser automation (Executor) for E2E verification
- Rich UI extraction (Extractor) for agent consumption
- Comprehensive evaluation (Evaluator) with programmatic + AI checks
- Orchestration (Planner) to choose the right verification layer

---
Part 4: Implementation Roadmap

Phase 0: Research Documentation (Current Phase)

Deliverables: 5 research documents + updated idea.md
- research/01-ui-representation.md — UI representation survey with practical
recommendations
- research/02-browser-automation.md — Browser automation patterns and best
practices
- research/03-ui-evaluation.md — Evaluation methods survey with tool
comparisons
- research/04-agent-architecture.md — Agent patterns for UI verification
- research/05-framework-design.md — Complete framework architecture, module
interfaces, design decisions

Phase 1: ui-fast-verify MVP

Modules involved: Simplified Observer + Simplified Evaluator
- Persistent Vite render service
- Props/Context injection
- Screenshot + DOM output
- Error capture
- CLI (serve, render)

Phase 2: UI Extractor Module

Core capability: Extract structured UI representation from running pages
- Playwright accessibility tree extraction + bounding boxes
- DOM simplification pipeline (pruning, flattening, indexing)
- CDP integration for computed styles, layout info
- Output: structured JSON representation (a11y tree + spatial + visual
metadata)

Phase 3: Observer Module

Core capability: Reliable page state observation
- Composite screenshot stability (font/image/animation/DOM/network)
- DOM diff tracking (before/after comparison)
- Loading state detection
- Performance metrics collection

Phase 4: Evaluator Module

Core capability: Multi-dimensional UI quality assessment
- Programmatic checks: layout anomalies, overflow, spacing tokens,
accessibility (axe-core)
- Visual regression: Playwright toHaveScreenshot() integration
- VLM evaluation: structured prompt templates for Claude Vision/GPT-4V
- Design system compliance: token validation pipeline

Phase 5: Executor Module

Core capability: Browser automation for agent-driven verification
- Playwright action execution (click, type, scroll, navigate)
- Authentication handling (storageState)
- SPA navigation support
- Multi-step interaction sequences

Phase 6: Agent Planner + Integration

Core capability: Orchestration and intelligent layer selection
- Verification coordinator (choose layer based on what's being verified)
- ReAct loop for complex verification tasks
- Batch verification mode
- AI Agent SDK / MCP integration
