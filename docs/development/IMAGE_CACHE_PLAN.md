# Image caching and opening animation: implementation plan

Status: implementation in progress. The server supports SHA-256 image URLs via the `content` query parameter, ETag revalidation for existing image URLs and a no-store redirect for a valid but stale hash. The UI build generates a deterministic manifest and versioned HTML, CSS and web manifest; dynamic image markup uses the same hashes. Development watch refreshes the generated files when inputs change. The server still hashes bytes on each request. The opening flight now waits for the sprout and background to decode; if the app is ready first or loading fails, it skips the flight rather than block. The latest integration and opening changes have not yet been tested, visually verified or deployed.

## Step 1 findings — 2026-11-04

This is a source inventory and a sample of public production HTTP responses, not a browser waterfall. Local checkout and remote `Staging` and `main` all resolved to `74b14e9618e7bb694d8e3b22d53e59b98eee21e6` when checked. The remote refs alone do not prove the deployed SHA. The development diary and `docs/frontend/DESIGN.md` were reviewed.

### Image inventory and priority

Sizes below are raw file bytes from the checkout, not compressed transfer sizes. Priority is an implementation recommendation based on where the code uses the asset; actual browser fetch order and visibility still need a network trace. An image in HTML or CSS is not necessarily downloaded at first paint in every browser.

| Priority / consumer | Paths or families | Raw bytes | Notes |
| --- | --- | ---: | --- |
| Critical opening | `/brand/reed/growth/bodies/sprout.svg` | 442 | Initial HTML and runtime mascot markup. The image is separate from the inline face and CSS animation. |
| Critical opening background | `/brand/reed/vein-pattern.svg` | 256 | CSS background used by the opening and its exit backdrop. |
| App shell / navigation | `/brand/reed/{petal,leaf}-token.svg`; `/brand/icons/collections/{library,bookcase}.svg`; `/brand/icons/navigation/home.svg` | 656 / 513; 334 / 540; 255 | HTML markup includes wallet and navigation images. Some shell content is hidden during opening. |
| App shell / settings | `/brand/icons/languages/{es,en}.svg` | 289 / 498 | Present in initial HTML; visibility and actual network timing need browser confirmation. |
| Mascots, selected by state | `/brand/reed/growth/bodies/{pot-a-body.png,seed.svg,root.png,seedling.svg,sprout.svg,stem-flat.svg,flower.png}`; `/brand/reed/growth/{mystery,plant,infinity}.svg` | 61,458; 383; 757,812; 500; 442; 750; 950,311; 434; 661; 848, respectively | `app/mascot-art.mjs`; home, profile, practice and other views select assets at runtime. Root and flower are much larger than the opening SVG. Do not assume they are both requested at startup. |
| Pot facial layers | `/brand/reed/growth/bodies/pot-a-{left-eye,right-eye,mouth}.png` | 1,456 / 1,433 / 3,532 | `app/mascot-face.mjs` constructs SVG `<image href>` paths dynamically. |
| Collection and deck views | `/brand/icons/collections/{library,bookcase,shelf,decks,decks-add,deck-badge}.svg` | 245–540 | `app/views.mjs`; `deck-badge.svg` is used both as a CSS mask and an external SVG `<use>` with `#deck-badge-shape`. |
| Book layout / reading | `/brand/icons/book-layout/{covers,shelf,stack}.svg`; `/brand/icons/note-capture/{cards,cards-pen,cards-read,reading-guide}.svg`; `/brand/reed/card-back.svg` | 469–625; 354–732; 2,348, respectively | CSS masks/backgrounds; loaded as needed by browser and active styles. |
| Contextual controls | `/brand/icons/languages/globe.svg`; `/brand/platforms/{amazon,goodreads}.svg`; `/brand/reed/streak-flame.svg` | 253; 2,113 / 675; 862 | Dynamic language and platform paths in views. The streak currently has a manual `?v=3`. |
| Browser / install / social discovery | `/favicon.ico`; `/brand/reed/app-icon.svg`; `/brand/reed/app-icon-{192,512}-v4.png`; `/brand/reed/share-card.png`; embedded Apple touch icon | 3,161; 1,064; 7,141 / 21,748; 22,779; embedded icon is part of HTML | Favicon and app SVG currently have manual `?v=4`. Manifest icons and social metadata have their own consumers. `server/http.mjs` also maps conventional Apple touch icon aliases to `brand/reed/apple-touch-icon.png` (6,677 bytes). Keep these aliases and crawler behavior in scope. |

Reference sources found: `app/index.html`, `app/manifest.webmanifest`, `app/reader.css`, `app/book-list.css`, `app/mascot-art.mjs`, `app/mascot-face.mjs`, and `app/views.mjs`. Check generated output and runtime paths as part of implementation; do not treat the inventory as proof that every state was rendered. The dynamic collection names used by `collectionIconMarkup` include `library`, `bookcase`, `shelf`, and `decks`; currency icons include `petal` and `leaf`; platform choices are `amazon` and `goodreads`; deck flags are `es` and `en`, with `globe` as fallback. Books use app-rendered covers. No external or user-specific image source was identified in the inspected app markup; social metadata points to the public image on the same origin. This is not an audit of all possible API data or future features.

No `loading="lazy"`, `fetchpriority`, preload link, `new Image()` or image `decode()` call was found in the searched non-test app sources. This is a source observation, not a measured browser loading sequence. The existing opening flight begins in CSS, while `waitForOpeningFlight` observes its completion; the app does not wait for the sprout to decode before the flight starts.

### Production HTTP baseline

Public `HEAD` requests on 2026-11-04 returned HTTP 200 and `Cache-Control: no-cache` for `/app/`, `/app/reader.css`, `/app/manifest.webmanifest`, the sprout, the opening pattern, `root.png`, `/favicon.ico`, and `/brand/reed/share-card.png`. The sampled responses had no `ETag` or `Last-Modified` header. A `GET` of the sprout with an arbitrary `If-None-Match` returned 200, without an ETag. An arbitrary query `?v=nonexistent` also returned the sprout with 200 and `no-cache`: the present server does not verify image versions. Sampled responses reported `server: cloudflare`, `x-render-origin-server: Render`, and `cf-cache-status: DYNAMIC`.

These checks do **not** prove whether Cloudflare includes query strings in a cache key when immutable caching is enabled, nor do they measure repeat-session behavior. Verify both against the chosen implementation and production configuration before rollout. Obtain cold/warm browser waterfalls and slow-network captures before changing the opening, and compare them after implementation. Avoid assuming an unmeasured first-load delay is caused only by image transfer.

## Goal

Keep app images in the browser cache across sessions. A changed image must get a new URL based on its content. The opening animation must look complete on a cold cache and must never block the app if an image fails.

Use the existing Node server and browser HTTP cache. Apache is not needed. Do not add a service worker, database, CDN or external storage unless a specific need below makes it necessary.

## Current state

- `server/http.mjs` serves allowlisted static files under `/app/` and `/brand/`, sets `Cache-Control: no-cache` by default and gives versioned fonts a one-year immutable cache. Image responses do not currently have content hashes or conditional validators. API and session cache rules must remain separate.
- `scripts/build-ui.mjs` only builds the React entry point. `npm start` and `npm test` run this build through their pre-scripts; Render also runs it in its build command. `app/generated/` is ignored by Git.
- Image references occur in `app/index.html`, `app/manifest.webmanifest`, `app/reader.css`, `app/book-list.css`, `app/views.mjs`, `app/mascot-art.mjs`, and `app/mascot-face.mjs`. Some paths are created dynamically, and there is an external SVG `<use>` with a fragment. Check for additional references before implementation; this list is not a complete contract. `brand/` also contains explorations that are not app assets.
- The opening markup is in `app/index.html`. Its sprout image and background pattern are external resources. CSS starts the animation independently of image loading. `app/opening-flight.mjs` observes the existing flight and `app/reader-app.mjs` coordinates it with loading and an exit overlay. The opening also supports reduced motion.
- Render builds a fresh deployment from the repository (`render.yaml`). It does not provide an automatic history of old image files. A new deployment can coexist briefly with requests from old tabs.

## Recommended design

1. Generate a deterministic asset manifest during the existing build. Key it by canonical, same-origin image path and derive each version from the actual file bytes using SHA-256. Use the full digest or a collision-resistant fixed-length prefix, and specify its length in code and tests. Generate identical output for identical input. Fail the build on missing referenced files, ambiguous mappings or collisions.
2. Make app-owned image references resolve to their content-addressed URL, including HTML, CSS, JS-generated markup, dynamically selected assets, SVG references and web manifest icons. For example, `/brand/reed/growth/bodies/sprout.svg?v=<digest>`. Preserve query parameters and fragments correctly. Do not rewrite arbitrary user data, external URLs, API responses or entire JavaScript files using an unsafe text substitution. Document the supported sources and cover them with tests. Keep development/watch builds working.
3. For a versioned image request, verify that the requested digest matches the bytes served before setting `Cache-Control: public, max-age=31536000, immutable`. `GET` and `HEAD` must agree on headers and status. Do not apply this policy to HTML, CSS, JS, APIs, private data, errors, redirects, unversioned aliases, or mismatched hashes. Preserve path containment, MIME types, `nosniff`, CSP and existing public icon aliases. Account for intermediaries: any CDN or proxy must include the query string in its cache key; use content-addressed filenames instead if that cannot be guaranteed.
4. Keep unversioned image paths for existing clients and conventional discovery. Use `Cache-Control: no-cache` and a content-based `ETag`, supporting `If-None-Match` and bodyless `304` for GET/HEAD. A legacy URL is never immutable. Do not accidentally change existing API or HTML cache policies.
5. Handle an old hash that is no longer available with a **temporary, `no-store` redirect to the current, verified content-addressed URL** for the same safe, canonical path. If the image no longer exists, return a non-cacheable 404 and use an appropriate visual fallback. Do not return new bytes at the old URL with immutable caching. Redirects must preserve relevant fragments in browser behavior, avoid loops, and never permit external or arbitrary destinations. This is a deliberate compatibility fallback: an old tab may see the new image, rather than the exact old image. Test it across a simulated deployment. If exact old artwork is required, choose the retained-assets option in the risks section before shipping.
6. Make the initial sprout available with the first HTML response where practical, generated from the canonical asset at build time rather than maintained as a second hand-edited copy. Alternatively, preload it and start the animation only after load/decode. Coordinate the pattern and all animated layers so they start together or use a stable visual fallback. Keep the initial state stable while assets load. Preserve reduced motion, accessible loading status, error/retry behavior, overlay timing and cancellation behavior. A bounded failure path must allow the app to open; reuse the project's central time rules for any new timeout. Never wait indefinitely for image decoding or animation completion.

Use normal browser caching rather than custom client storage. Cache eviction, private browsing and a user's cache settings are outside the app's control; correctness must not rely on a cached copy.

## Risks and options, ordered by implementation simplicity

### Old tabs request old images after deployment

Example: a tab opened with image A later requests A, but deployment B no longer contains A. Returning B with A's hash and `immutable` would corrupt the meaning of the URL.

1. **Recommended: non-cacheable redirect to the current hashed image**, as described above. No external storage. Old tabs may display the new image; deleted assets need a fallback.
2. Keep a bounded history of old hashed image files in the deployed artifact or repository. Define retention, size limits and cleanup; tabs older than the retention window still need a fallback. Verify that Render's build has access to that history.
3. Store immutable assets in persistent object storage or a CDN and retain them under their content hashes. Define retention, cost, access, deployment ordering and cleanup. This is more infrastructure and needs explicit configuration.

If old code requires an exact asset version for correctness, option 1 is insufficient. If a redirect from a hashed URL is considered unacceptable for the URL contract, return `no-store` 404 and implement a tested recovery in the client instead; do not silently serve mismatched bytes.

### References can bypass versioning

1. **Recommended: explicit shared asset resolver plus build-generated mappings**, with explicit build handling for HTML, CSS and manifest references. Cover dynamic paths and SVG fragments; fail validation for unknown app-owned image references. This makes the contract visible.
2. Use a build pipeline that parses and rewrites all relevant source formats and emits hashed assets. This can reduce manual mapping but requires careful support for dynamic paths, external SVG references and current unbundled modules.
3. Introduce a broader bundler migration. This is more disruptive and is not needed solely for caching.

Do not assume a regex over source code covers runtime-generated paths. Generated bundles and CSS imports also need inspection. Stable icon URLs, favicon conventions and social crawlers may use unversioned paths; define and test those exceptions.

### Cached HTML, CSS or JavaScript refers to the wrong asset generation

1. **Recommended: keep shell and code revalidated**, generate references and hashes from the same build, and use the old-hash fallback above. Verify mixed old/new deployments and rolling requests.
2. Version the entire app shell and retain old releases atomically. This adds deployment and cleanup work.

Do not make a source file immutable unless its own URL is also content-addressed. Confirm that Render and any intermediary honor the intended cache keys and headers.

### First visit or slow connection starts the animation too early

1. **Recommended: inline the critical sprout from the canonical source at build time** and synchronize the remaining visual layers. Measure HTML size and verify CSP and accessibility. A data URI is not automatically decoded before CSS animation starts, so verify actual paint timing; use an explicit readiness gate if needed.
2. Preload the critical assets and gate the flight on successful decode, with a bounded fallback. Coordinate all layers, including the CSS background and exit overlay.
3. Add a dedicated preload screen or new animation system. This changes UX and requires design review; do not add decorative copy.

Test cold and warm caches, slow network, failure, reduced motion and a fast API response. Starting the animation from JavaScript must not race `waitForOpeningFlight` or restart an existing flight.

### Missing or failed images block startup or break navigation

1. **Recommended: fail open** with a stable fallback and a bounded wait. Keep the app usable and respect reduced motion. Test failure and cancellation explicitly.
2. Offer an explicit retry only if the missing asset actually prevents a user task. Do not add unnecessary UI.

### Server cost or inconsistent hashes

1. **Recommended: generate hashes once in the build**, validate the mapping and use a bounded in-memory manifest. Ensure that a server never grants immutable caching to bytes that do not match the URL, including if files change during development.
2. Hash on each request. This is simpler initially but adds file reads and CPU; measure before choosing it.
3. Delegate delivery to a CDN or object store. Only justified by measured traffic or infrastructure requirements.

### Cache invalidation, browser eviction and stale intermediaries

1. **Recommended: content-addressed URLs, revalidated shell, non-cacheable failures and redirects**, and no dependence on a browser retaining assets. Test query-string cache keys in the actual delivery path.
2. Use hashed filenames if a proxy ignores query strings, and keep the same old-version recovery contract.
3. Add a service worker only for a separately approved offline requirement. It introduces its own update, eviction and rollback lifecycle.

### Security and public/private boundaries

1. **Recommended: limit versioning and public caching to known public image files**, use the existing realpath containment checks and MIME allowlist, and retain CSP and `nosniff`. Do not expose arbitrary paths, private data or directory listings through the manifest or redirect. Include traversal, malformed URL and method tests.
2. Create a separate public static origin with a strict asset allowlist if the existing server cannot enforce these invariants. This increases operational scope.

### Deployment, rollback and asset retention

1. **Recommended: deploy code, manifest and assets together**, support both old and new tabs during rollout and rollback, and check the actual production headers and browser behavior. Keep unversioned aliases for old clients.
2. Publish versioned assets before the app and retain them independently. This requires a persistent asset host and an explicit cleanup policy.

Rollback must not reuse a hash for different bytes. Keep the old-hash recovery behavior in both deployment directions. Do not rely on `/api/health` to validate image delivery.

## Implementation sequence

1. Recheck current `Staging`, the latest development diary and `docs/frontend/DESIGN.md`. Inventory real app image references, their consumers, sizes, load priority and current production response headers. Record any externally hosted or user-specific images separately.
2. Implement deterministic manifest generation and verify complete coverage. Choose and document the precise URL format and redirect behavior. Keep the build reproducible and idempotent, including `--watch`.
3. Integrate versioned URLs across app-owned references and add safe server delivery, conditional legacy responses and old-hash recovery. Keep legacy behavior for existing icon and social preview URLs.
4. Fix opening readiness and the visual fallback. Reuse the existing animation and overlay contracts, avoid layout shifts and preserve accessible status and reduced motion.
5. Add focused tests, perform visual and network verification, then run the project-required checks and release workflow. Update this document with the final decisions and any accepted limitations.

## Acceptance and verification

- A cold browser gets the expected image; on a repeat session a fresh hashed URL is served from browser cache without an image network request, unless the browser evicted it. Inspect the network panel with cache enabled, not only server logs.
- Changing bytes changes only the relevant image URL; unchanged bytes keep their URL across builds. A new app version shows the new image. The server never marks mismatched content immutable.
- A simulated old tab requests an uncached old hash after deployment: the selected recovery works, cannot loop or redirect off-site, and is not cached. Test deletion, rollback, old and new instances, GET and HEAD, malformed hashes and path traversal.
- Unversioned image aliases revalidate with ETag/304. HTML, JS, CSS, API, session, errors, favicon and web manifest behavior remain correct. SVG `<use>` fragments, dynamic mascot/flag/platform paths, CSS masks and manifest icons work.
- On cold cache with throttled network, the opening does not reveal a half-loaded mascot or begin in the middle. Test a warm cache, reduced motion, load/decode failure, cancellation, delayed API, fast API, mobile viewport and keyboard/accessibility behavior. The app always becomes usable.
- Add meaningful server/build tests and browser checks for these contracts. Use simulated providers for any AI-related tests. Run `npm test` using `.node-version`; commands that open local listeners require elevated permissions from the first attempt, as specified in `AGENTS.md`.
- Work on shared `Staging`, without a PR or manual push to `main`. After authorized code changes, push to `Staging`, confirm full CI, promotion of the tested SHA to `main`, and the Render deployment of that SHA. Follow the Git worktree and escalation rules in `AGENTS.md`. Do not claim delivery if any stage fails.

## Explicit non-goals

Offline operation, caching personalized API responses, image editing or visual redesign, a new copywriting campaign, and adding Apache. Do not cache user-specific images publicly without a separate security and product decision.
