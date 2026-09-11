# Invitation-only access

The private SVG certificates, token manifest and allowlist are generated outside Git with `scripts/generate-invitations.mjs`. Never commit or paste any of them. Load the comma-separated hashes as the private Worker secret `INVITATION_HASHES`.

Each certificate is a reusable bearer credential for one account. The upload gate decodes its QR locally, validates it through `/api/invitation/validate`, and retains it in this browser. Every API request carries the token only in `X-L3V-Invitation`; the Worker hashes it and forwards only the account ID to l3v-tools.

New request receipts are deterministically derived from the certificate and random request ID. This lets the My work index reconstruct the existing request-specific authorization without storing raw receipts in the database. Existing ownership, replay, expiry, Turnstile, rate limits, quotas and the 100-credit video cap remain in force.

Deploy the matched backend migration and code first. Then deploy this merged website revision with existing variables preserved and set `INVITATION_ONLY=true`. Confirm invalid or missing certificates receive 403, a valid certificate opens the site, My work lists both tool scopes, and locking removes the browser token. These checks do not submit generation.
