# l3v AI tools

React application for Magic Identity and AI Video Suggestion, built with Vite, with two spaces for future tools, 60 color themes, and light/dark appearance.

Magic Identity shares first/last names across Magic Name, Magic Initials, and Magic Signature. Text previews are not generated artwork. Video references can be previewed locally. AI services remain disabled by default.

From `tools-website/`, run `pnpm install --frozen-lockfile` then `pnpm dev` and open http://127.0.0.1:4185. For the production build, run `pnpm build` then `pnpm preview`. On localhost only, the site can embed a separately running editor on port 4184; public visitors never connect to that editor.

`src/` contains React components and shared utilities. `public/` contains original assets, pricing/model snapshots and public integration configuration. Vite generates the ignored `dist/` deployment output; do not edit it by hand. `public/integration-config.js` keeps analysis disabled until an authenticated public bridge is verified. No private gateway secrets belong in browser code. Pricing uses a versioned catalog snapshot with stale-price warnings.

Run `pnpm check` for queue/error/pricing checks and a production build. Run `pnpm exec playwright install chromium` once, then `pnpm test:e2e` for browser regression tests against the built output. Provider interactions are simulated in tests; no paid AI calls are made.

Production: https://tools.l3v.ai — direct Cloudflare Workers Static Assets. See DIRECT-HOSTING.md and wrangler.jsonc. Build first, then deploy with Wrangler 4; ChatGPT Sites is no longer used. The older application in the repository root is historical; this subproject owns the current tools.l3v.ai UI.

React owns navigation, appearance, identity inputs, reference previews, analysis/report rendering and optional first-frame controls. No legacy DOM event scripts run alongside React. Existing hash links, storage keys and public API payloads are preserved. `Intl.Segmenter` keeps combining marks together in initials previews. Material mockups, logo editing and lettering generation are still upcoming backend integrations, not features enabled by this migration.
