# Video request access

This website adapter targets backend PR26, merged as
`12e8ab7180b293d096deba24a6c06de057ed6bfd` in AI-l3v-tools. It is not compatible
with the older visitor-only gateway. Public generation remains disabled.

The browser creates a random 32-hex request ID and independent 64-hex receipt and
verifies sessionStorage persistence before admission. A SHA256 of the prepared
reference recovers the same root for manual replay of that reference in the same
tab. Storage contains receipts, fingerprints, job IDs and selected video settings;
it does not contain source images, prompts, challenge tokens or provider keys.

All Video admission/status calls carry `X-L3V-Request-Id` and
`X-L3V-Request-Receipt`. The site Worker sends these as a separate `access` object
to the private queue gateway, with its own authenticated quota identity. It never
calls Runway. Provider credentials remain on l3v-tools. Do not log request headers
or upstream bodies: they contain the access receipt.

`Check saved request` restores known analysis/frame jobs after a refresh; the video
panel checks its saved video job. If the first analysis response was lost, adding
the same image recovers the root. Lost frame/video admissions can be explicitly
replayed with the same receipt and immutable settings. Backend stage admission
returns the existing job; it must never create another provider attempt. There are
no automatic admission retries, including for failed or ambiguous jobs. Closing
the tab or clearing session storage can lose access; this is not account recovery.

The compact Image/Facebook Reel input and sample result layout are unchanged.
Facebook extraction remains unavailable; this adapter supports the existing
prepared-image analysis flow, not downloading Facebook media.

## Deployment gates

The existing `l3v-ai-tools` Worker dispatches the five Video API routes to
`video-worker.mjs`. Name-logo routes retain their existing handler. Wrangler's
`run_worker_first` includes those exact Video paths; no new domain is created.

Keep `public/integration-config.js` disabled and `VIDEO_RECEIPTS_READY` unset or
false until database tests, the shared receipt migration, matched backend rollout
and private browser acceptance pass. Merging this PR alone does not enable a paid
flow or deploy the backend.

At rollout the Worker uses its existing private settings: `HERMES_URL` points at
the HTTPS queue gateway, `HERMES_TOKEN` authenticates that gateway, and the existing
Turnstile settings verify actions on tools.l3v.ai. Admission paths are selected by
the adapter, never by a browser-provided URL. `ANALYZER_ENABLED`, `FRAMES_ENABLED`
and `VIDEO_ENABLED` still gate each capability; all require `VIDEO_RECEIPTS_READY`.
`VIDEO_MAX_CREDITS_PER_JOB` defaults to 100 and must agree with the server cap.
`VIDEO_OUTPUT_BASE_URL` must be the protected HTTPS media base. No secrets belong
in this document, client configuration or Git.

Use the backend's `deploy/VIDEO-REQUEST-RECEIPTS.md` for database and runtime rollout
prerequisites. Promote only reviewed merged revisions through GitHub. Do not
reapply queue initialization, change existing quotas, or activate unrelated workers.

## Validation

The normal `check` command now includes receipt persistence and edge contract tests.
Browser tests cover blocked storage, stable receipt on manual replay, receipt
propagation across all stages, refresh recovery, and lost frame/video responses.
They mock service/provider responses and incur no generation charges.
