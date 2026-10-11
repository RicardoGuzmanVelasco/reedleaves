# Growth mascot study

This is the art source for the per-book mascot stages used by the app. The existing two-leaf app mascot is the **Sprout** stage. **Root** uses the selected ginger-root concept in `root.png` and unlocks after spending leaves on cards for that book on two distinct local days. **Seedling** uses the green leafy seed from the original Sprout study and unlocks after three distinct review days. **Sprout** follows after five distinct review days. The final **Evergreen** stage restores the original **Living loop / Bucle vivo** mascot as a local asset, including its face placement.

The user approved **Flowerpot** and **Seed** as shown, named the existing app mascot **Sprout**, approved the ginger-root **Root** artwork, approved **Seedling** with widely spaced eyes, asked to distinguish **Sprout** from **Sapling**, and asked to restore the original loop symbol. Sapling, Stem, Plant, and Flower remain stage-art proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Flowerpot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `pot.svg` |
| Seed | Open the first review card. | `seed.svg` |
| Root | Spend leaves on cards for the book on two distinct local days. | `root.png` |
| Seedling | Spend leaves on three distinct local days across any deck for the book. | `seedling.svg` |
| Sprout | Spend leaves on five distinct local days across any deck for the book. | `../mascot.svg` |
| Sapling | TBD; not active in the app. | Hidden silhouette in the app. |
| Stem | TBD; not active in the app. | Hidden silhouette in the app. |
| Plant | TBD; not active in the app. | Hidden silhouette in the app. |
| Flower | TBD; not active in the app. | Hidden silhouette in the app. |
| Evergreen | TBD; not active in the app. | Hidden silhouette in the app. |

The Root, Seedling, and Sprout day thresholds are active product rules. Other unlock conditions are undecided. Progress is monotonic: switching decks or changing the book's `reading` / `read` status must never downgrade a mascot already earned.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- `root-variations-exploration.png`: rough sheet of three alternate root shapes, saved for future exploration. These are proposals only; the approved Root remains `root.png` and the variants are not used in the app.
- `seedling.svg` reuses the original green seed artwork. `infinity.svg` restores the original **Bucle vivo / Living loop** mascot as the **Siempreviva / Evergreen** stage. Its face coordinates come from `faceMarkup` in `brand/sprout/spike.js`: eyes `(23,76)` and `(137,76)`, mouth centered at `(80,96)`. The spike contains the animated expressions.

Open `index.html` to review the art. Progress is aggregated across decks for the same book. Motto text is maintained in `mottos.md`.

Names and Spanish/English mottos follow `mottos.md`: **Retoño / Sapling** follows Sprout; **Siempreviva / Evergreen** keeps the existing `infinity.svg` artwork and internal `infinity` ID. Sapling remains locked with a neutral silhouette; no unlock condition has been chosen.
