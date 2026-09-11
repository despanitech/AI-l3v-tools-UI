# Matched Magic Name release

Merge this UI change with backend feature/name-logo-complete-flow. See its deploy/NAME-LOGO-COMPLETE-RELEASE.md for database/worker/private acceptance sequencing. Both changes are required; do not enable this edge against the visitor-based backend.

NAME_LOGO_RECEIPTS_READY defaults off. Enable only after the shared receipt ledger, name-logo backend and private acceptance are verified. Existing NAME_LOGO_ENABLED, HTTPS gateway/token, Turnstile and limiter requirements remain. NAME_LOGO_SESSION_SECRET now signs the stable IP-based quota subject, not an ownership cookie; do not rotate it casually because it changes quota buckets. Receipts grant access independently of IP changes.

Requests persist in sessionStorage before the first submission. Refresh retains access. Lost admission responses expose Recover saved request, which repeats the original request/receipt with a fresh security check. Server replay is idempotent. Images are fetched with receipt headers and displayed/downloaded via blob URLs. Receipts are never put into resource URLs or visible markup. Browser-session deletion is not account recovery.

Validation: five name-logo edge tests, two storage tests, two browser scenarios (mocked successful generation/download and lost-response recovery after reload). Existing Video edge tests also pass. These tests do not claim a real provider image has been generated. Real private generation and exact-name visual inspection must happen from the merged backend before enabling public generation.
