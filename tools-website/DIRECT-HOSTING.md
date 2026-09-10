# Direct Cloudflare hosting

The website is deployed directly to the user's Cloudflare account as Worker `l3v-ai-tools`, serving `dist/` as static assets. The intended production domain is `tools.l3v.ai`.

Deploy using Wrangler from this directory: `wrangler deploy`.

AI generation remains disabled in `dist/integration-config.js`. No private backend is exposed by this static deployment. Local-only editor links stay hidden for public visitors.

The earlier ChatGPT Sites deployment was not the requested hosting provider. Its legacy project ID is retained in local deployment notes only and must not be used for future deployments.
