# Direct Cloudflare hosting

The website is deployed directly to the user's Cloudflare account as Worker `l3v-ai-tools`, serving `dist/` as static assets. The intended production domain is `tools.l3v.ai`.

From this directory, run `pnpm install --frozen-lockfile`, `pnpm check` and `pnpm test:e2e` (install Playwright Chromium once if needed), then deploy the merged source with `wrangler deploy`. Vite builds the static React application into `dist/`; it is generated output and is no longer committed. The existing Worker name and production domain are unchanged.

AI generation remains disabled in `public/integration-config.js`, copied into the build. No private backend is exposed by this static deployment. Local-only editor links stay hidden for public visitors.

The earlier ChatGPT Sites deployment was not the requested hosting provider. Its legacy project ID is retained in local deployment notes only and must not be used for future deployments.
