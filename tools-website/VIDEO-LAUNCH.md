# Consolidated Video launch

This release includes both image and public Facebook Reel submissions, receipt
recovery, private network admission, Turnstile action verification and two edge
throttles. Keep public generation disabled until the live checklist passes.
The server repository contains the matching Reel extractor and readiness check.

## Provision once; do not overwrite the name-logo setup

Use the existing Cloudflare account and `l3v-ai-tools` Worker. Reuse the shared
Turnstile widget restricted to `tools.l3v.ai`; actions are `reference_analyze`,
`reference_frame`, `reference_video`, and `name_logo`. Widget mode is managed.
The public sitekey belongs in `TURNSTILE_SITEKEY`; its secret remains a Worker
secret. No Runway or image-provider key belongs in the website or Worker.

`provision-video-secrets.mjs WRANGLER_JS_PATH` accepts a private JSON object on
stdin containing exactly `HERMES_TOKEN`, `TURNSTILE_SECRET`, and `VIDEO_TEST_IPS`.
Obtain the gateway token from the protected server configuration over the
authenticated administrative channel, not from a browser or chat. Do not print
the input. The helper sends it to Wrangler's bulk secret endpoint without writing
it to disk or logging subprocess output. `VIDEO_TEST_IPS` is a comma-separated
allowlist of the tester's actual public addresses. This is a network restriction,
not an individual user account system; shared networks share access and quotas.

Nonsecret Worker settings:

| Setting | Private acceptance value |
| --- | --- |
| HERMES_URL | https://tools-api.l3v.ai |
| VIDEO_OUTPUT_BASE_URL | https://tools-api.l3v.ai/media |
| TURNSTILE_SITEKEY | Existing site-restricted widget key |
| VIDEO_ACCESS_MODE | private |
| VIDEO_RECEIPTS_READY | true after migration verification |
| ANALYZER_ENABLED | true |
| FRAMES_ENABLED | true |
| VIDEO_ENABLED | true |
| VIDEO_MAX_CREDITS_PER_JOB | 100 |
| REELS_ENABLED | false until server Reel readiness and live extraction pass |

Deploy only an exact reviewed merged UI SHA. Keep existing name-logo secrets,
variables and tunnel routes. Wrangler includes `VIDEO_ADMISSION_LIMITER` namespace
20331 (8/minute), `VIDEO_POLL_LIMITER` 20332 (60/minute) and `NAME_LOGO_LIMITER`
20333 (8/minute), coordinated with the name-logo task. Verify namespace uniqueness
in this account before deployment. Edge throttles are per location and eventually
consistent; the database's atomic quotas and queue limits remain the budget guard.
Use `--keep-vars` when deploying, and never accidentally switch access to public.

## Server preparation

Install the matching merged backend through Git. Its generic service environment
must retain the catalog, database, gateway and media configuration. Install the
optional `requirements-reels.txt` only into the reviewed Video runtime and provide
`/usr/bin/ffmpeg` and `/usr/bin/ffprobe`. Run `analyzer/reel_readiness.py` with that
runtime as `l3vtools`; it invokes no provider. The analysis worker also checks these
dependencies on startup when `MODELPEDIA_REELS_ENABLED=true`.

The previous release's `video-release-disabled.env` is loaded last by systemd.
Changing an earlier env file cannot enable frame/video admission. After the edge
private gate is verified, set the final override to the intended private-test
flags, restart the queue, then start only the dedicated analysis/frame/video units.
Keep the 100-credit limit. Do not touch independent lettering or name-logo units.
Never run the installer again to recover an uncertain provider attempt.

## Acceptance evidence required before public launch

1. Save backend/UI SHAs, Worker version, DB test report and readiness output.
2. Verify config disabled and POST denied from an address outside the private list.
3. From the authorized browser upload one image. Complete the real Turnstile
   checks, review analysis, explicitly create one frame and one 5-second 480p
   silent video. Record job IDs and actual charges where available.
4. Refresh and recover the same request, frame and video. Verify playback and
   download. A second button click/recovery must not admit a second paid job.
5. Verify missing/foreign receipt rejection and expiry in the disposable DB;
   do not mutate live expiry or delete receipt tombstones to make a test pass.
6. Use one public Reel (1–90 seconds, at most 30 MB, available without login).
   Verify canonical URL replay uses the same root. Analysis sees six visual
   samples only; no audio/transcript claims. Login-only, unavailable and oversized
   Reels must fail without reaching the model. Record a real extraction result;
   mocked browser tests are not evidence of Facebook availability.
7. Only then switch `VIDEO_ACCESS_MODE` to `public`. Leave Reel support disabled if
   its live check has not passed. Keep an explicit rollback: set access mode to
   `disabled` and stop new admission, preserving status/attempt data for review.

`playwright.video.config.mjs` runs isolated local mocked browser tests; Node Worker
tests verify limits, origin, Turnstile, receipt propagation and private gating.
These do not authorize or claim paid live acceptance. The tests intentionally do
not automate Turnstile bypasses or replay ambiguous provider calls.
