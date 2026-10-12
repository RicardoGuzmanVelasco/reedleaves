# Growth mascot study

This is the art source for the per-book mascot stages used by the app. The existing two-leaf app mascot is the **Sprout** stage. **Root** uses the selected ginger-root concept from `root.png`, composited through the transparent derivative `root-cutout.png`, and unlocks after spending leaves on cards for that book on two distinct local days. **Seedling** uses the green leafy seed from the original Sprout study and unlocks after three distinct review days. **Sprout** follows after five distinct review days. The final **Evergreen** stage restores the original **Living loop / Bucle vivo** mascot as a local asset, including its face placement.

The user approved **Flowerpot** and **Seed** as shown, named the existing app mascot **Sprout**, approved the ginger-root **Root** artwork, approved **Seedling** with widely spaced eyes, asked to distinguish **Sprout** from **Sapling**, and asked to restore the original loop symbol. Sapling, Stem, Plant, and Flower remain stage-art proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Flowerpot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `pot.svg` |
| Seed | Open the first review card. | `seed.svg` |
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

`root.png` is the original approved artwork and visual-size reference. Flowerpot and Seed keep their tighter square viewBoxes; removing their shadows does not change their framing, paths or faces.

The reusable `app/mascot-art.mjs` and `app/mascot-art.css` component composes all stages. The ground ellipse matches Flowerpot's adjusted frame: center at `(50%, 87.5%)`, width `92.307692%`, height `15.384615%`, color `#1E4C2E` at 16% opacity. These values depend only on component size, never on stage placement or animation. Root and Seedling have shared placement calibration; Seed retains its suspended position. Placement and motion use separate nested elements so animation cannot override calibration.

Ground shadows have been removed from Pot, Seed, Mystery, Stem, Plant and Flower SVGs. Embedded darker parts of the characters are retained. Future stage proposals remain unavailable in the app.

`root-cutout.png` is the transparent web derivative produced with the built-in image tool. The original opaque `root.png` remains unchanged. The component uses the derivative with normal compositing, without `multiply`.

[Composition comparison](composition.html) checks all five available stages plus Mystery at large and small sizes, their greeting, frame boundaries and Root on three backgrounds. The brand study and app share the same component.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- `root-variations-exploration.png`: rough sheet of three alternate root shapes, saved for future exploration. These are proposals only; the approved Root remains `root.png` and the variants are not used in the app.
- `seedling.svg` reuses the original green seed artwork. `infinity.svg` restores the original **Bucle vivo / Living loop** mascot as the **Siempreviva / Evergreen** stage. Its face coordinates come from `faceMarkup` in `brand/sprout/spike.js`: eyes `(23,76)` and `(137,76)`, mouth centered at `(80,96)`. The spike contains the animated expressions.

Open `index.html` to review the art. Progress is aggregated across decks for the same book. Motto text is maintained in `mottos.md`.

Names and Spanish/English mottos follow `mottos.md`: **Retoño / Sapling** follows Sprout; **Siempreviva / Evergreen** keeps the existing `infinity.svg` artwork and internal `infinity` ID. Sapling remains locked with a neutral silhouette; no unlock condition has been chosen.

## Root cutout prompt

Built-in image tool, transparent background: “Background extraction only. Make a clean transparent PNG cutout of the supplied ginger root mascot, retaining its original exact artwork, gradients, tan and green colors, face, pose, silhouette, and framing. Subject pixels must stay fully opaque; transparency is only outside the character with smooth anti-aliased edges. Completely remove the original white textured background. No leftover specks or islands outside the silhouette, no red/yellow pixels or colored edge fringes, no white halo, no new shadow. Do not redesign or redraw anything. Use true alpha transparency, no checkerboard baked into image.” The result was inspected at actual UI sizes on cream, green, peach and blue backgrounds.
