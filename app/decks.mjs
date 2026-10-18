export function availableVersions(catalog, bookId) {
  return catalog.decks.filter(d => d.bookId === bookId).map(deck => {
    const versions = catalog.versions.filter(v => v.deckId === deck.id && v.status !== "archived").sort((a,b) => b.number - a.number);
    const version = versions.find(v => v.status === "published") || versions[0];
    return version ? {deck,version,tags:[]} : null;
  }).filter(Boolean);
}

export function featuredDecks(catalog, bookId) {
  const choices = availableVersions(catalog,bookId), winners = [];
  const recommended = choices.find(c => c.deck.isRecommended);
  if (recommended) { recommended.tags.push("recommended"); winners.push(recommended); }
  for (const [tag,metric] of [["popular","startedBy"],["preferred","likes"]]) {
    const winner = [...choices].sort((a,b) => b.deck.metrics[metric] - a.deck.metrics[metric] || a.deck.id.localeCompare(b.deck.id))[0];
    // Zero activity is not a community award. Same winner appears only once.
    if (winner?.deck.metrics[metric] > 0) {
      winner.tags.push(tag);
      if (!winners.includes(winner)) winners.push(winner);
    }
  }
  return [...winners,...choices.filter(c => !winners.includes(c))];
}

export function studyingDecks(catalog, reviews, enrolledIds = []) {
  const enrolled = new Set(Array.isArray(enrolledIds) ? enrolledIds : []);
  // Recommendations are not enrolments. Started versions remain visible even
  // when the daily selection changes or the author publishes a newer version.
  return catalog.versions.filter(version => {
    const count = reviews[version.id]?.seenIds.length || 0;
    return (count < version.cardCount || version.status === "draft" && version.cardCount === 0) && (count > 0 || enrolled.has(version.id));
  }).map(version => ({version,deck:catalog.decksById.get(version.deckId),
    book:catalog.booksById.get(version.bookId),review:reviews[version.id] || restoreTreeReview(null,catalog.versionModels.get(version.id),version.id)}));
}

export function cardSiblings(card,model) {
  const siblings = model.children.get(card.parentId) || [];
  return card.parentId === null ? siblings.filter(c=>!!c.isQuote === !!card.isQuote) : siblings;
}

export function restoreTreeReview(saved, model, versionId) {
  let value = saved?.versionId === versionId ? saved : {};
  const seenIds = [...new Set((Array.isArray(value.seenIds) ? value.seenIds : []).filter(id=>model.byId.has(id)))];
  return {versionId,seenIds,currentId:seenIds.includes(value.currentId) ? value.currentId : seenIds.at(-1) || null};
}

export function openTreeCard(saved, model, versionId, cardId) {
  const review = restoreTreeReview(saved,model,versionId), card = model.byId.get(cardId);
  if (!card) return {review,opened:false};
  const seenIds = review.seenIds.includes(cardId) ? review.seenIds : [...review.seenIds,cardId];
  return {review:{...review,seenIds,currentId:cardId},opened:true};
}

export function reviewedCard(review, model, requestedId) {
  const id = review.seenIds.includes(requestedId) ? requestedId : review.currentId;
  return review.seenIds.includes(id) ? model.byId.get(id) : null;
}

export function treeLinks(card, model) {
  if (!card) return {sibling:null,child:null,parent:null};
  const siblings = cardSiblings(card,model), i = siblings.findIndex(c => c.id === card.id);
  return {sibling:siblings[i+1] || null,child:model.children.get(card.id)?.[0] || null,
    parent:card.parentId ? model.byId.get(card.parentId) : null};
}

export function bookReviewStates(catalog, reviews) {
  return Object.fromEntries(catalog.books.map(book => {
    const versions = catalog.versions.filter(v => v.bookId === book.id), started = versions.filter(v => reviews[v.id]?.seenIds.length);
    const ongoing = started.some(v => reviews[v.id].seenIds.length < v.cardCount);
    return [book.id,{hasReviewedCards:started.length>0,hasReviewing:ongoing}];
  }));
}
