# Growth mascot study

This is a visual spike, not an approved product feature. It tests one mascot that changes form as a user reviews a book. The existing two-leaf app mascot is the **Sprout** stage. **Seedling** is a proposed stage directly after Seed, using the green leafy seed from the original Sprout study. The final **Infinity** stage restores the original **Living loop / Bucle vivo** mascot as a local asset, including its face placement.

The user approved **Pot** and **Seed** as shown, named the existing app mascot **Sprout**, asked to distinguish **Sprout** from **Sapling**, and asked to restore the original Infinity symbol. Root, Seedling, Sapling, Stem, Plant, and Flower remain stage-art proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Pot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `pot.svg` |
| Seed | Open the first review card. | `seed.svg` |
| Root | Review 20% of the selected deck. | `root.svg` |
| Seedling | TBD | `seedling.svg` |
| Sprout | Review 40%. | `../mascot.svg` |
| Sapling | TBD | Artwork pending; name and motto in `mottos.md` |
| Stem | Review 60%. | `stem.svg` |
| Plant | Review 75%. | `plant.svg` |
| Flower | Review 90%. | `flower.svg` |
| Infinity | Review every card in the selected deck. | `infinity.svg` |

The thresholds are a proposal for discussion. Short decks may skip intermediate percentage stages. The production rule must be monotonic: switching decks or changing the book's `reading` / `read` status must never downgrade a mascot already earned.

## Open model question

One mascot belongs to a book, while a book can have several decks with different trees and sizes. This spike measures progress against one deck and does not decide how multiple deck histories combine into one book-level state. Recommended next decision: keep the highest stage reached in any deck for that book; do not add card totals from unrelated trees.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- `seedling.svg` reuses the original green seed artwork. `infinity.svg` restores the original **Bucle vivo / Living loop** mascot as the **Infinito / Infinity** stage. Its face coordinates come from `faceMarkup` in `brand/sprout/spike.js`: eyes `(23,76)` and `(137,76)`, mouth centered at `(80,96)`. The spike contains the animated expressions.

Open `index.html` to review the art. The percentage thresholds and multi-deck progress rule remain proposals. Motto text remains placeholder content.
