export function availableDecks(catalog, bookId) {
  return catalog.decks.filter(deck => deck.bookId === bookId && deck.status !== "archived").map(deck => ({deck,tags:[]}));
}

export function featuredDecks(catalog, bookId) {
  const choices = availableDecks(catalog,bookId), winners = [];
  const recommended = choices.find(c => c.deck.isRecommended);
  if (recommended) { recommended.tags.push("recommended"); winners.push(recommended); }
  for (const [tag,metric] of [["preferred","likes"]]) {
    const winner = [...choices].sort((a,b) => b.deck.metrics[metric] - a.deck.metrics[metric] || a.deck.id.localeCompare(b.deck.id))[0];
    // Zero activity is not a community award. Same winner appears only once.
    if (winner?.deck.metrics[metric] > 0) {
      winner.tags.push(tag);
      if (!winners.includes(winner)) winners.push(winner);
    }
  }
  return [...winners,...choices.filter(c => !winners.includes(c))];
}

export function cardSiblings(card,model) {
  const siblings = model.children.get(card.parentId) || [];
  return card.parentId === null ? siblings.filter(c=>!!c.isQuote === !!card.isQuote) : siblings;
}


export function treeLinks(card, model) {
  if (!card) return {sibling:null,child:null,parent:null};
  const siblings = cardSiblings(card,model), i = siblings.findIndex(c => c.id === card.id);
  return {sibling:siblings[i+1] || null,child:model.children.get(card.id)?.[0] || null,
    parent:card.parentId ? model.byId.get(card.parentId) : null};
}
