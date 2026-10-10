# Growth mascot study

This is a visual spike, not an approved product feature. It tests one mascot that changes form as a user reviews a book. The existing two-leaf app mascot is the **Sprout** stage; the final **Infinity** stage reuses the original loop symbol directly from the Sprout study.

The user approved **Pot** and **Seed** as shown, named the existing app mascot **Sprout**, and asked to restore the original Infinity symbol. Root, Stem, Plant, and Flower are simplified redesign proposals for review.

## Proposed stages

| Stage | Proposed trigger | Source |
| --- | --- | --- |
| Pot | Add a book to the user's shelf. Its original reading status can be `reading` or `read`. | `pot.svg` |
| Seed | Open the first review card. | `seed.svg` |
| Root | Review 20% of the selected deck. | `root.svg` |
| Sprout | Review 40%. | `../mascot.svg` |
| Stem | Review 60%. | `stem.svg` |
| Plant | Review 75%. | `plant.svg` |
| Flower | Review 90%. | `flower.svg` |
| Infinity | Review every card in the selected deck. | `../../sprout/loop.svg` |

The thresholds are a proposal for discussion. Short decks may skip intermediate percentage stages. The production rule must be monotonic: switching decks or changing the book's `reading` / `read` status must never downgrade a mascot already earned.

## Open model question

One mascot belongs to a book, while a book can have several decks with different trees and sizes. This spike measures progress against one deck and does not decide how multiple deck histories combine into one book-level state. Recommended next decision: keep the highest stage reached in any deck for that book; do not add card totals from unrelated trees.

## Files

- `index.html`: visual comparison of all stages.
- `mottos.md`: edit the Spanish and English motto placeholders here.
- Each new stage is an individual SVG; Sprout and Infinity reuse existing brand assets.

Open `index.html` to review the art. The percentage thresholds and multi-deck progress rule remain proposals. Motto text remains placeholder content.
