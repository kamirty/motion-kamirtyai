# Kamirty Motion — Claude Code project instructions

You are implementing a browser-first, Arabic RTL motion-infographic editor. Read README.md, docs/PRODUCT_BRIEF_AR.md, docs/TECHNICAL_ARCHITECTURE_AR.md, docs/TEST_PLAN_AR.md, and schemas/project.v1.schema.json before making changes.

## Non-negotiable product rules
- Each project targets **exactly 120 seconds** of media duration (3600 frames at 30fps).
- The site must remain a **static deploy**: React, TypeScript, Vite, client-side Canvas/SVG, Mediabunny + WebCodecs only when supported. No server render, paid AI/video/TTS API, backend account, billing, database, or cloud user content uploads.
- Do not send descriptions, uploaded assets, or user-produced video to external services. Static library/font delivery is allowed only if self-hosted and privacy reviewed.
- Deterministic function `renderFrame(project, frameIndex, ctx)` is the single source of truth for preview and export.
- Preserve Arabic shaping and bidirectional text. Use ctx.direction='rtl', suitable Arabic fonts and measured layout. **Never reverse Arabic strings or text tokens manually.**
- MVP default: silent infographic video, Windows desktop Chrome + Edge first; audio/TTS and mobile full export are later milestones.
- Support feature detection and graceful fallback; never promise MP4 on unsupported browsers.
- Avoid Remotion and FFmpeg WASM in the initial browser-only MVP unless an ADR justifies them and licensing/performance is explicitly reviewed.
- Respect third-party licenses; package attributions in the repo.
- Sanitize/validate arbitrary input, enforce limits and HTML-safe rendering. No `innerHTML` with user-provided text.
- No secret keys or telemetry without permission.

## Engineering process
- One Git branch and one focused pull request per task. Never force-push to main.
- Before modifying code, state files to be changed, test plan, and expected tradeoffs.
- Implement working testable slices, not mock success controls.
- After code: run typecheck, tests, build, report output and outstanding failures.
- Add Arabic test strings including Arabic + numerals + Latin abbreviations.
- If unsupported feature: disable control with accurate explanation, do not silently degrade quality.
- Do not assume external hosting credentials are available.

## Current state (v1)
Milestone 0 (export proof) passed, and the owner asked for the complete tool, so v1 ships:
- Deterministic Arabic parser (`src/engine/parser`) → storyboard → planner (`src/engine/planner.ts`); it never invents facts, and thin descriptions get bracketed guide scenes.
- Eight scene kinds (`src/engine/renderer/scenes.ts`), three aspects (16:9, 9:16, 1:1), four transitions, four animated backgrounds, eight palettes, eight self-hosted OFL Arabic fonts, Arabic-Indic/Western digit switch, Lucide icons with Arabic keyword matching.
- Editor UI (`src/app`): idea sidebar, live preview, scene timeline with thumbnails, scene inspector, undo/redo, local autosave, JSON open/save.
- Export: MP4 (H.264 + AAC/Opus) or WebM (VP9/VP8 + Opus), 720p or 1080p, with procedurally synthesised royalty-free music or a local user audio file; the result is re-read and verified.
- Hosting decision (with the owner): GitHub Pages from the `gh-pages` branch at motion.kamirtyai.com (Squarespace DNS CNAME `motion` → `kamirty.github.io`). Cloudflare Pages is not needed because no COOP/COEP headers are required.

Keep `renderFrame` pure (no clocks/randomness); backgrounds may use cached offscreen layers only as deterministic speed-ups.
Run `npm run typecheck && npm test && npm run build` before every push.
