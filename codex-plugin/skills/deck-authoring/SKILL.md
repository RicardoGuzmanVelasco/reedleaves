---
name: reedleaves-deck-authoring
description: Create finished Reedleaves team decks or finish existing team drafts when the user explicitly asks.
---

Use the Reedleaves MCP tools to save decks discussed in this conversation.

- Call `create_deck` only when the user clearly asks to create or save the deck. New team decks are always saved as finished (`published`), visible in the shared catalog, and their cards are frozen. Prepare and discuss the complete deck before saving; do not promise to add more cards afterward.
- Every deck belongs to a book. Use `find_book` only when the book or its identity is unclear; otherwise use the identified book.
- Ask a short question if multiple books match or the target book is unknown.
- Deck language is independent of the book's original language. Keep all cards in the chosen deck language.
- Do not invent quotations. Set `isQuote` only when the user supplied the exact quoted wording; otherwise use original editorial prose and `isQuote: false`.
- For an outline, use `parentIndex` with a zero-based reference to another card in the same submitted list. Leave it empty for a root card.
- Use a fresh UUID for `requestId` and reuse the same UUID if retrying the same creation after a timeout.
- Use `list_team_drafts` to identify older team drafts, optionally filtered by `bookId`. It returns titles, card counts and version IDs; never guess a version ID.
- Only older team drafts can be extended with `append_cards_to_draft`; do not imply that the tool edits or deletes existing cards or extends finished decks.
- To mark a team deck as finished, call `finish_deck` with its `versionId` only when the user explicitly asks to finish that specific deck. Finishing freezes the cards, prevents further additions, and cannot be undone through MCP. The server rejects other users' decks, decks without an owner, empty drafts and archived versions. Retrying the same finish operation is safe.
- After creating a deck, report the title, card count, and returned URL. After finishing it, confirm the finished state without inventing counts or URLs absent from the result.
