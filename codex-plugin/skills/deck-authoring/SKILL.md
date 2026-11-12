---
name: reedleaves-deck-authoring
description: Prepare and publish Equipo Reedleaves decks using the Reedleaves MCP, including missing books, or finish existing team drafts when explicitly requested.
---

# Reedleaves decks

Use the Reedleaves MCP and discover its current tools and schemas. Follow their publication and attribution rules. Do not save a deck until the user clearly asks to create or save it, and prepare all its cards before saving: creation publishes and freezes it.

## Book

Search the catalog and tell the user whether the book exists. Resolve ambiguity before selecting it. If it does not exist, ask whether they want to create it, even if they already requested the deck. If they agree, prepare and show the intended book data before creation: author, titles and languages, Spanish and English descriptions and editorial notes, interests, and any available links. Propose one interest if it adequately describes the book; propose more only when useful, explaining why. Agree on the interest or interests with the user before creating the book. Use only verified Amazon and Goodreads links, and omit them if unavailable. Do not include other links or sources in the book or deck.

## Cards

Identify the material's origin; ask if unclear:

- **Passages or notes taken from the book:** preserve the exact wording and language the user provides. Never invent, silently correct, translate, or paraphrase a quotation. Ask when the wording, language, or treatment is uncertain.
- **The user's own rough notes:** preserve their intent; rephrase and improve clarity when appropriate. Show the proposed wording for review.
- **Created from scratch:** ask for the deck language, research as appropriate, and write specific, useful notes with sufficient context. Use an impersonal style without repeatedly naming the author in cards. Avoid generic, repetitive, or filler content. Do not present interpretations as verified quotations.

For user-provided notes, use their language; clarify mixed languages or uncertainty. The book's original language, catalog title languages, and deck language are independent. Mark a card as a quotation only when its wording was supplied by the user and it is intended as a quotation. Do not invent quotations. Do not add source citations or links to decks or cards.

## Review and publish

Present the complete draft in an easily editable format, with each card's title and body clearly separated. Incorporate the user's changes. A request to propose a deck is not a request to publish it; create it only when the user clearly asks to save or create the deck. Respect an explicit request to publish a specified complete deck without adding an extra approval step. Publication attributes the deck to Equipo Reedleaves and freezes it. Report the result and provide the actual deck sharing link if the MCP returns one; never invent a link. If the MCP only returns a book link, identify it as such and say that a deck sharing link was not provided.

## MCP details

- Use `parentIndex` to express card hierarchies, with a zero-based reference to another submitted card.
- Use a fresh UUID for each creation request and reuse it when retrying the same operation.
- Use `list_team_drafts` to identify older team drafts; do not guess IDs. Only existing drafts can be extended with `append_cards_to_draft`.
- Call `finish_deck` only when the user explicitly asks to finish that specific team draft. Finishing freezes its cards. Report only details returned by the MCP.
