# Name-logo browser connection

Uses the backend contract merged in AI-l3v-tools PR 22. Samples stay separate from generated results. A request reference is saved before submission; uncertain submissions cannot silently generate again. Status polling never submits generation. Completed images use an owner-checked same-origin download route.

## Deployment configuration

The worker serves static assets and handles only `/api/name-logo/*`. With no settings it reports generation disabled, so the existing sample flow remains available.

After private server acceptance, configure the HTTPS protected gateway URL as `NAME_LOGO_URL`, secrets `NAME_LOGO_TOKEN` and `NAME_LOGO_SESSION_SECRET` (independent random values), `TURNSTILE_SECRET`, `TURNSTILE_SITEKEY`, and a Cloudflare rate-limiter binding named `NAME_LOGO_LIMITER`. Set `NAME_LOGO_ENABLED=true` only when all launch controls are ready. The limiter applies per source IP; persistent per-customer budgets remain a backend launch requirement, not supplied by this limiter. Do not mark public launch ready based only on the browser tests.

Signed Secure/HttpOnly/SameSite cookies keep visitor identity out of browser requests. The same owner is used for admission, status and image download. Cookies and backend results expire after seven days. Requests require same-origin POST and Turnstile action `name_logo` to generate. Gateway tokens stay at the edge.

## Validation and remaining server work

Local integration and worker tests pass; Playwright verifies name preservation, successful response rendering, download links and no duplicate submission using intercepted test responses. This is not evidence of a live provider call. The server requires interactive sudo and its existing GitHub fetch failed host-key verification as the SSH user. No live generation has been enabled or attempted.

Cloudflare static asset routing follows https://developers.cloudflare.com/workers/static-assets/routing/worker-script/ .
