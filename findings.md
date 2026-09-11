# Research & Findings: UI/UX Intelligence

## Reference Images Analysis (`ui improvement ideas/`)
1. **Reference 1 (Surrealist Preferences)**:
   - Sidebar/tab-based category navigation with glowing active pill indicator.
   - Clean 2-column input rows: label on top, muted description underneath, right-aligned controls.
   - Focus outline glow on search inputs.
2. **Reference 2 (Lunaris System Configuration)**:
   - High-tech, dark obsidian dashboard aesthetic.
   - Top status header with live state pill, date/time, and reset/save buttons.
   - Grouped sections with category icons and subtitles.
   - Custom toggles and color swatch nodes.
3. **Reference 3 (Untitled UI Appearance)**:
   - Visual theme cards (Light/Dark/System) with mini wireframe previews and top-right checkmark badges.
   - Density and view mode selection cards.
4. **Reference 4 (CureSync Settings)**:
   - Top pill tabs for switching setting sections.
   - 2-column dropdown and setting layout with dark rounded cards.
5. **Reference 5 (macOS Sonoma System Settings)**:
   - Circular theme accent swatches with checkmarks.
   - Density preference pills (`Roomy`, `Cozy`, `Compact`).
6. **Reference 6 (Themes Gallery)**:
   - Preset themes presented as sleek cards with gradient avatar spheres.
   - Segmented color mode switcher (`[ Light | Dark | System ]`).
7. **Reference 7 (Shift Desktop App)**:
   - Glassmorphic modal with frosted blur and high-contrast typography.
   - Segmented buttons (`[ None | Important | All ]`).
8. **Reference 8 (Task Manager / Telemetry)**:
   - Deep oceanic dark teal / cyan tinted glass cards with micro-metrics.
   - Monospace telemetry data chips and status badges.
9. **Reference 9 (Agent Deck)**:
   - Cyberpunk developer layout with frosted modal over darkened backdrop.
   - Tabbed navigation bar with custom rounded active states.
   - Preset theme rows showing multi-color swatch dot sequences.

## Performance & Architecture Findings
- The app builds with Vite 8 + oxc in ~950ms.
- Running on port 1420 via Tauri/Vite dev server.
- Existing `WallpaperThumbnail` handles lazy loading and viewport intersection to keep RAM under ~30MB.
- UI changes must strictly use CSS custom properties and avoid heavy runtime libraries or animation loops that burn CPU/GPU cycles.
