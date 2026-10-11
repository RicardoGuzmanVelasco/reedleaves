# Growth mascot study

This is an internal art study and the source for the per-book mascot stages currently used by the app. The existing two-leaf app mascot is the **Sprout** stage. **Seedling** uses the green leafy seed from the original Sprout study and is the stage unlocked after three distinct review days. **Sprout** follows after five distinct review days. The final **Evergreen** stage restores the original **Living loop / Bucle vivo** mascot as a local asset, including its face placement.

The user approved **Flowerpot** and **Seed** as shown, named the existing app mascot **Sprout**, approved **Seedling** with widely spaced eyes, asked to distinguish **Sprout** from **Sapling**, and asked to restore the original loop symbol. Root, Sapling, Stem, Plant, and Flower remain stage-art proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Flowerpot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `pot.svg` |
| Seed | Open the first review card. | `seed.svg` |
| Root | TBD; not active in the app. | Hidden silhouette in the app. |
| Seedling | Spend leaves on three distinct local days across any deck for the book. | `seedling.svg` |
| Sprout | Spend leaves on five distinct local days across any deck for the book. | `../mascot.svg` |
| Sapling | TBD; not active in the app. | Hidden silhouette in the app. |
| Stem | TBD; not active in the app. | Hidden silhouette in the app. |
| Plant | TBD; not active in the app. | Hidden silhouette in the app. |
| Flower | TBD; not active in the app. | Hidden silhouette in the app. |
| Evergreen | TBD; not active in the app. | Hidden silhouette in the app. |

The Seedling and Sprout day thresholds are active product rules. Other unlock conditions are undecided. Progress is monotonic: switching decks or changing the book's `reading` / `read` status must never downgrade a mascot already earned.

## Open model question

One mascot belongs to a book, while a book can have several decks with different trees and sizes. This spike measures progress against one deck and does not decide how multiple deck histories combine into one book-level state. Recommended next decision: keep the highest stage reached in any deck for that book; do not add card totals from unrelated trees.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- `seedling.svg` reuses the original green seed artwork. `infinity.svg` restores the original **Bucle vivo / Living loop** mascot as the **Siempreviva / Evergreen** stage. Its face coordinates come from `faceMarkup` in `brand/sprout/spike.js`: eyes `(23,76)` and `(137,76)`, mouth centered at `(80,96)`. The spike contains the animated expressions.

Open `index.html` to review the art. Progress is aggregated across decks for the same book. Motto text is maintained in `mottos.md`.

Names and Spanish/English mottos follow `mottos.md`: **Retoño / Sapling** follows Sprout; **Siempreviva / Evergreen** keeps the existing `infinity.svg` artwork and internal `infinity` ID. Sapling remains locked with a neutral silhouette; no unlock condition has been chosen.
