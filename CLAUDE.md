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

## Milestone 0 only
Build a proof of concept: 3 deterministic Arabic Canvas scenes, frame-based timeline totalling 3600 frames, preview seeking, MP4/WebM feature detection, 120-second 1280x720 export if the browser allows, and downloadable sample project JSON. No AI, no uploads, no voice, no login, no CSS framework requirement yet. Validate generated file metadata / duration and collect export diagnostics.
