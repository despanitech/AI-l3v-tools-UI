# Sample results in the existing Video tool

Open the normal `/#video` route. The existing header, navigation, themes and input
layout remain. Inputs are now Image (JPG/PNG/WebP, 8 MB) and Facebook Reel URL.
Canonical HTTPS numeric `/reel/` and `/reels/` paths on facebook.com,
www.facebook.com and m.facebook.com are accepted; share redirects are not yet
supported. Adding a Reel records its URL in the local component only. It does not
attempt to play a Facebook webpage as an MP4, fetch it or claim extraction works.
Live submission is gated for Reel references until backend extraction is wired.

The separate View sample results button renders example analysis, model/setup,
cost, steps, and labeled first-frame/video placeholders below the existing form.
It issues no API calls and creates no receipt. The results identify the input mode
and selected filename/URL, while explicitly stating the sample is not its analysis.
Changing/removing the reference clears sample results. Live results are preserved
but hidden while viewing the sample. The original paid-generation gates remain.

No standalone design page, unrelated illustration, private media or credentials
are included. Production Facebook ingestion and receipt integration remain
separate backend work. Deployment must follow the user-reviewed GitHub merge.
