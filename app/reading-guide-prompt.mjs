import {isReadingGuideDeck} from "./decks.mjs";

export function hasAccessibleReadingGuide(catalog,bookId) {
  return catalog.decks.some(deck=>deck.bookId===bookId && deck.status!=="archived" &&
    isReadingGuideDeck(catalog,deck) && (catalog.deckModels.get(deck.id)?.cards||[]).some(card=>card.isReadingGuide));
}

export function hasOwnReadingGuide(catalog,bookId,userId) {
  return !!userId && catalog.decks.some(deck=>deck.bookId===bookId && deck.status!=="archived" &&
    isReadingGuideDeck(catalog,deck) && (catalog.deckModels.get(deck.id)?.cards||[]).some(card=>card.isReadingGuide&&card.creatorUserId===userId));
}

export function shouldShowReadingGuidePrompt({previousStatus,nextStatus,saveSucceeded,hasGuideCards}) {
  return saveSucceeded && previousStatus!=="reading" && nextStatus==="reading" && hasGuideCards;
}

export function shouldOfferReadingGuideCreationPrompt({previousStatus,nextStatus,saveSucceeded,hasOwnGuide}) {
  return saveSucceeded && previousStatus!=="read" && nextStatus==="read" && !hasOwnGuide;
}
