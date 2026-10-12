# Growth mascot study

This is the art source for the per-book mascot stages used by the app. The existing two-leaf app mascot is the **Sprout** stage. **Root** uses the selected ginger-root concept from `root.png`, composited through the transparent derivative `root-cutout.png`, and unlocks after spending leaves on cards for that book on two distinct local days. **Seedling** uses the green leafy seed from the original Sprout study and unlocks after three distinct review days. **Sprout** follows after five distinct review days. The final **Evergreen** stage restores the original **Living loop / Bucle vivo** mascot as a local asset, including its face placement.

The user approved **Flowerpot** and **Seed** as shown, named the existing app mascot **Sprout**, approved the ginger-root **Root** artwork, approved **Seedling** with widely spaced eyes, asked to distinguish **Sprout** from **Sapling**, and asked to restore the original loop symbol. Sapling, Stem, Plant, and Flower remain stage-art proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Flowerpot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `bodies/pot-a-body.png` (A · Classic; previous body retained in `pot.svg`) |
| Seed | Open the first review card. | `bodies/seed.svg` (B · Almendrada; previous art: `seed.svg`) |
| Root | Spend leaves on cards for the book on two distinct local days. | `root-cutout.png` (original: `root.png`) |
| Seedling | Spend leaves on three distinct local days across any deck for the book. | `seedling.svg` |
| Sprout | Spend leaves on five distinct local days across any deck for the book. | `../mascot.svg` |
| Sapling | TBD; not active in the app. | Hidden silhouette in the app. |
| Stem | TBD; not active in the app. | Hidden silhouette in the app. |
| Plant | TBD; not active in the app. | Hidden silhouette in the app. |
| Flower | TBD; not active in the app. | Hidden silhouette in the app. |
| Evergreen | TBD; not active in the app. | Hidden silhouette in the app. |

The Root, Seedling, and Sprout day thresholds are active product rules. Other unlock conditions are undecided. Progress is monotonic: switching decks or changing the book's `reading` / `read` status must never downgrade a mascot already earned.

## Visual scale

The active Seed now uses the approved **B · Almond-like / Almendrada** silhouette in `bodies/seed.svg`, adapted to SVG with the exact shared face supplied by the app. `seed.svg` remains the previous artwork for historical comparisons. Seed keeps its 94% scale, current facial calibration and floating ground shadow. [Future Seed proposals](seed-variations-future.md) retains A, C, D, F and G, with the requested refinements; E is discarded. Only B is selected for product use.

Flowerpot uses the original pixels of reserved **A · Classic / Clásica** from `pot-variations-future.png`, without redrawing or generating a new version. The 340 × 340 crop starts at (104, 80); `bodies/pot-a-body.png` and the original eye/mouth patches restore that crop pixel for pixel. `bodies/pot-a-original.png` is the transparent source cutout for comparison. The prior SVG adaptation is historical. Its overhanging lower rim covers the angular body joins, and its soil sits coherently inside the oval opening. The previous body in `bodies/pot.svg` is kept as historical artwork. The other five proposals remain available in [the retained variation sheet](pot-variations-future.md).

`root.png` is the original approved artwork and visual-size reference. Flowerpot and the historical Seed keep their tighter square viewBoxes; removing their shadows did not change their framing, paths or faces. The active almond-shaped Seed uses the shared 160 × 160 frame.

The reusable `app/mascot-art.mjs` and `app/mascot-art.css` component composes full characters. Icons use `mascotIcon`, which outputs a direct body image with context-specific dimensions and no character transforms. The ground ellipse keeps Flowerpot's adjusted baseline and height, with a narrower common width: center at `(50%, 87.5%)`, width `72%`, height `15.384615%`, color `#1E4C2E` at 16% opacity. These values depend only on component size, never on stage placement or animation. Seed uses 94% scale. Seedling uses 90% scale and a -10% vertical offset; Sprout uses a -8% vertical offset. All three float above the ground. Root keeps its existing calibration. Placement and motion use separate nested elements so animation cannot override calibration. The 600 ms greeting combines the left/right rotation with one 8% upward hop and return, without rebound. Separate CSS `translate` and `transform` interpolation keep the vertical arc independent of the rotation; implicit rotation endpoints preserve the underlying hover pose without a snap after landing.

Ground shadows have been removed from Pot, Seed, Mystery, Stem, Plant and Flower SVGs. Embedded darker parts of the characters are retained. Future stage proposals remain unavailable in the app.

`root-cutout.png` is the transparent web derivative produced with the built-in image tool. The original opaque `root.png` remains unchanged. The component uses the derivative with normal compositing, without `multiply`.

[Composition comparison](composition.html) checks all five available stages plus Mystery at large and small sizes, their greeting, frame boundaries and Root on three backgrounds. The brand study and app share the same component.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- `root-variations-exploration.png`: rough sheet of three alternate root shapes, saved for future exploration. These are proposals only; the approved Root remains `root.png` and the variants are not used in the app.
- `pot-variations-exploration.png`: six Flowerpot shape proposals: classic, bowl, round-bellied, tall, square and asymmetrical. No selection yet; the active Flowerpot is unchanged. Reference, review and prompt: `pot-variations-exploration.md`.
- `pot-variations-exploration-v2.png`: historical Flowerpot revision; A has coherent recessed soil inside an oval opening, and F replaces Asymmetrical with a rectangular planter based on `pot-planter-reference.png`. Review and prompt: `pot-variations-exploration-v2.md`.
- `pot-variations-future.png`: retained six-variant Flowerpot sheet, with A's slightly wider, lower overhanging collar covering the angular body joins. A is now the active app body; B, C, D, E and F remain future proposals. Decisions and final prompt: `pot-variations-future.md`.
- `seed-variations-exploration.png`: three alternate seed silhouettes (round, almond-like, kidney-bean), following the Root exploration format and the current five-mascot family. Proposals only; the approved Seed and app remain unchanged. References and generation prompt are recorded in `seed-variations-exploration.md`.
- `seed-variations-exploration-v2.png`: four more Seed proposals: two flattened pointed shapes and two coffee-bean shapes with a vertical central groove. References and prompt are recorded in `seed-variations-exploration-v2.md`. Not integrated in the app.
- `seed-variations-future.png`: consolidated future-only sheet of A, C, D, F and G. D is narrower with softer tips; F and G have subtler central grooves. Decisions and prompt: `seed-variations-future.md`. B is the active app Seed; E is discarded.
- `seedling.svg` reuses the original green seed artwork. `infinity.svg` restores the original **Bucle vivo / Living loop** mascot as the **Siempreviva / Evergreen** stage. Its face coordinates come from `faceMarkup` in `brand/sprout/spike.js`: eyes `(23,76)` and `(137,76)`, mouth centered at `(80,96)`. The spike contains the animated expressions.

Open `index.html` to review the art. Progress is aggregated across decks for the same book. Motto text is maintained in `mottos.md`.

Names and Spanish/English mottos follow `mottos.md`: **Retoño / Sapling** follows Sprout; **Siempreviva / Evergreen** keeps the existing `infinity.svg` artwork and internal `infinity` ID. Sapling remains locked with a neutral silhouette; no unlock condition has been chosen.

## Root cutout prompt

Built-in image tool, transparent background: “Background extraction only. Make a clean transparent PNG cutout of the supplied ginger root mascot, retaining its original exact artwork, gradients, tan and green colors, face, pose, silhouette, and framing. Subject pixels must stay fully opaque; transparency is only outside the character with smooth anti-aliased edges. Completely remove the original white textured background. No leftover specks or islands outside the silhouette, no red/yellow pixels or colored edge fringes, no white halo, no new shadow. Do not redesign or redraw anything. Use true alpha transparency, no checkerboard baked into image.” The result was inspected at actual UI sizes on cream, green, peach and blue backgrounds.
