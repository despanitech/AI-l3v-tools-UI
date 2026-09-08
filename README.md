# AI Video Modelpedia

An open-source guide to AI video models: strengths, limitations, genre recommendations, sample frames, and practical workflows.

**Website:** https://video.l3v.ai

## Explore

- 36 model profiles with strengths, weaknesses, use cases, and sources
- 20 short-video genres with an image carousel and practical recommendations
- 40 credited preview images
- Expandable usage and parameter explanations
- Light and dark modes with 60 palettes
- Downloadable standalone HTML guide

Recommendations are editorial judgments based on cited documentation and examples, not controlled benchmarks. Check source dates and provider documentation before relying on availability or specifications.

## Run locally

Requires Node.js 22.13 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

## Build

```sh
node export-html.mjs
pnpm build
```

The first command regenerates `public/ai-video-model-guide.html`, including the genre preview images and interactive controls. The second builds the React/Vinext application.

## Edit the guide

- `app/guide.json`: model profiles and references
- `app/genres.json`: genre recommendations and workflows
- `app/genre-frames.json`: preview paths, original sources, model labels, and credits
- `app/themes.json`: appearance palettes
- `app/globals.css`: shared styles

Production is hosted directly on Cloudflare Workers Static Assets at `video.l3v.ai`. The full standalone guide includes the interactive genre selector, frame browsing, expandable details, and saved appearance preferences.

```sh
pnpm deploy:production
```

Authenticate Wrangler to your Cloudflare account before deployment. `production/wrangler.jsonc` defines the existing Worker and custom domain. Forks should replace the account, Worker name, and domain with their own values. GitHub pushes do not automatically deploy.

The original Sites project configuration is retained in `.openai/hosting.json` for reference, but its publishing/domain tools failed with callback conflicts. Do not use Sites domain tools to manage production; the domain now belongs to the direct Cloudflare Worker.

## Contributions

Corrections and additions are welcome. Include primary sources, distinguish documented capabilities from subjective recommendations, and preserve media attribution. Do not present filmed references or product illustrations as generated-video benchmarks.

## License and media

Original project code is available under the MIT license in `LICENSE`. Third-party dependencies retain their licenses. Third-party photos, extracted video frames, product illustrations, logos, and trademarks are excluded from the project's MIT grant and remain subject to their owners' rights and source terms. See `MEDIA_CREDITS.md` and the asset manifests for attribution. The code license does not grant permission to reuse third-party media.
