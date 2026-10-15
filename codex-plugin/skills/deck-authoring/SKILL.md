---
name: reedleaves-deck-authoring
description: Create or extend a Reedleaves deck from the current conversation when the user explicitly asks to save it.
---

Use the Reedleaves MCP tools to save decks discussed in this conversation.

- A saved draft is visible in the shared catalog. Call `create_deck` only when the user clearly asks to create or save the deck.
- Every deck belongs to a book. Use `find_book` only when the book or its identity is unclear; otherwise use the identified book.
- Ask a short question if multiple books match or the target book is unknown.
- Deck language is independent of the book's original language. Keep all cards in the chosen deck language.
- Do not invent quotations. Set `isQuote` only when the user supplied the exact quoted wording; otherwise use original editorial prose and `isQuote: false`.
- For an outline, use `parentIndex` with a zero-based reference to another card in the same submitted list. Leave it empty for a root card.
- Use a fresh UUID for `requestId` and reuse the same UUID if retrying the same creation after a timeout.
- To extend a team draft, use the returned `versionId` with `append_cards_to_draft`; do not imply that the tool edits or deletes existing cards.
- After a successful write, report the title, card count, and returned URL.
