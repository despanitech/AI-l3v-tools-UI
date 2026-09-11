# Invitation-only access

The private SVG certificates, credential manifest and allowlists are generated outside Git with `scripts/generate-invitations.mjs`. Never commit or paste any of them. Load the comma-separated token hashes as the private Worker secret `INVITATION_HASHES`, and the sentence-hash-to-account mappings as `INVITATION_ALIASES`.

Three-word secrets are chosen with cryptographic randomness from the EFF large English passphrase word list in `scripts/eff-large-wordlist.txt`.

Each certificate is a reusable bearer credential for one account. Its funny sentence is an equivalent credential. The gate decodes the QR locally or accepts the sentence, validates it through `/api/invitation/validate`, and retains the chosen credential in this browser. Every API request carries it only in `X-L3V-Invitation`; the Worker resolves it and forwards only the account ID to l3v-tools.

New request receipts are deterministically derived from the stable account ID and random request ID. This means the certificate and sentence recover exactly the same work without storing raw receipts in the database. Existing ownership, replay, expiry, Turnstile, rate limits, quotas and the 100-credit video cap remain in force.

Deploy the matched backend migration and code first. Then deploy this merged website revision with existing variables preserved and set `INVITATION_ONLY=true`. Confirm invalid or missing certificates receive 403, a valid certificate opens the site, My work lists both tool scopes, and locking removes the browser token. These checks do not submit generation.
