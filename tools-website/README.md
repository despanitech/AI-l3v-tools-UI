# l3v AI tools

Minimal landing page for AI Magic Signature and AI Video Suggestion, with two spaces for future tools, 60 color themes, and light/dark appearance.

AI Magic Signature shares first/last names across Name as Logo, Nice Initials, and Super Signature. Text previews are not generated artwork. Video references can be previewed locally. AI services remain disabled by default.

Run `node server.cjs` and open http://127.0.0.1:4185. On localhost only, the site can embed a separately running editor on port 4184; public visitors never connect to that editor.

`dist/` is the complete static public website. `dist/integration-config.js` keeps analysis disabled until an authenticated public bridge is verified. No private gateway secrets belong in browser code. Pricing uses a versioned catalog snapshot with stale-price warnings.

Run `node --test integration.test.mjs` for queue/error and pricing checks.
