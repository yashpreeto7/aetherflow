# Task Plan: AetherFlow UI/UX Overhaul

## Goal
Transform AetherFlow's desktop UI/UX to match executive-grade desktop software aesthetics (inspired by the 9 provided design references: Surrealist, Lunaris, Untitled UI, CureSync, macOS Sonoma, Themes Gallery, Shift, Task Manager Telemetry, Agent Deck) while keeping the app ultra-lightweight (~30MB RAM), preserving all existing logic, and maintaining Canvas 2D / Tauri 2 architecture.

## Phases
- [x] Phase 1: Planning & Design System Foundation <!-- id: 0 -->
  - [x] Inspect user reference images in `ui improvement ideas/`
  - [x] Test current UI via Playwright MCP & take baseline screenshots
  - [x] Create persistent planning files (`task_plan.md`, `findings.md`, `progress.md`)
  - [x] Create implementation plan artifact and seek user approval
- [x] Phase 2: Design System & Styling Tokens (`themes.css` & `index.css`) <!-- id: 1 -->
  - [x] Add segmented controls, sleek toggles, telemetry badges, and glassmorphic card utilities
  - [x] Refine typography tracking and surface elevation gradients
  - [x] Verify build passes (`npm run build`)
- [x] Phase 3: Settings Page Transformation (`src/pages/Settings.jsx`) <!-- id: 2 -->
  - [x] Implement categorized tab navigation (Performance, Appearance & Themes, Thumbnails, Audio, Taskbar, System & Updates)
  - [x] Build visual theme selector cards with color swatches (Ref 6 & 9)
  - [x] Build visual taskbar and thumbnail presentation selector cards
  - [x] Verify build passes (`npm run build`)
- [x] Phase 4: Home Dashboard & Wallpaper Cards Polish (`src/pages/Home.jsx`) <!-- id: 3 -->
  - [x] Elevate Hero preview monitor card with telemetry HUD styling
  - [x] Refine wallpaper grid cards with subtle borders, glowing badges, and micro-interactions
  - [x] Verify build passes (`npm run build`)
- [x] Phase 5: App Shell, Sidebar & Waybar Status Bar Polish (`src/App.jsx`, `StatusBar`) <!-- id: 4 -->
  - [x] Refine sidebar active indicator, typography, and account popover
  - [x] Upgrade StatusBar with sleek telemetry HUD styling (live memory, live desktop indicator)
  - [x] Verify build passes (`npm run build`)
- [x] Phase 6: Playwright Visual Verification & User Walkthrough <!-- id: 5 -->
  - [x] Use Playwright MCP to capture screenshots of Home, Settings, Marketplace, Library
  - [x] Verify zero regressions, zero console errors, smooth 60fps animations
  - [x] Create walkthrough artifact and update CONTEXT.md / HANDOFF.md

## Key Decisions & Constraints
- Working logic untouched: All Tauri IPC, state hooks, MPV and WebStream engines remain 100% intact.
- Zero heavy dependencies: Pure CSS custom properties and lightweight React components.
- Canvas 2D only for wallpaper engines, no WebGL/Three.js.
- Offline-safe Supabase.
- Vite 8 / oxc build compliance.
