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

The live site is currently hosted with Sites and connected to the custom domain. A GitHub push does not automatically deploy it. `.openai/hosting.json` identifies the existing Sites project; it contains no credentials. Forks should use their own hosting configuration.

## Contributions

Corrections and additions are welcome. Include primary sources, distinguish documented capabilities from subjective recommendations, and preserve media attribution. Do not present filmed references or product illustrations as generated-video benchmarks.

## License and media

Original project code is available under the MIT license in `LICENSE`. Third-party dependencies retain their licenses. Third-party photos, extracted video frames, product illustrations, logos, and trademarks are excluded from the project's MIT grant and remain subject to their owners' rights and source terms. See `MEDIA_CREDITS.md` and the asset manifests for attribution. The code license does not grant permission to reuse third-party media.
