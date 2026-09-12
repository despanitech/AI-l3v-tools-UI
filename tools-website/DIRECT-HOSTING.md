# Direct Cloudflare hosting

The website is deployed directly to the user's Cloudflare account as Worker `l3v-ai-tools`, serving `dist/` as static assets. The intended production domain is `tools.l3v.ai`.

Every merged `develop` revision publishes a checksummed `ui-release-<revision>.tar.gz` GitHub Release asset. Deploy that immutable artifact with Wrangler; do not build from a source checkout during production deployment. The archive contains the tested Vite output, Worker modules, configuration, and its exact `REVISION`. The existing Worker name, bindings, variables, and production domain are unchanged.

AI generation remains disabled in `public/integration-config.js`, copied into the build. No private backend is exposed by this static deployment. Local-only editor links stay hidden for public visitors.

The earlier ChatGPT Sites deployment was not the requested hosting provider. Its legacy project ID is retained in local deployment notes only and must not be used for future deployments.
