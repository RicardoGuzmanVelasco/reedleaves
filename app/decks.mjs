import { restoreWallet, leafBalance, spendLeaf } from "./wallet.mjs";

const validDay = day => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);

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
  for (const [tag,metric] of [["popular","startedBy"],["preferred","likes"],["mostCompleted","completedBy"]]) {
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

function eligible(card, seen, model) {
  if (card.parentId !== null && !seen.has(card.parentId)) return false;
  const siblings = cardSiblings(card,model), i = siblings.findIndex(c => c.id === card.id);
  return i === 0 || seen.has(siblings[i-1].id);
}

export function restoreTreeReview(saved, model, versionId, legacy = null) {
  let value = saved?.versionId === versionId ? saved : {};
  if (!saved && legacy && versionId === model.cards[0].bookId + "-editorial-v1" &&
      model.cards.length === model.roots.length && validDay(legacy.lastUnlockDay) && Number.isInteger(legacy.unlockedCount)) {
    // Only the original flat editorial v1 can receive old book-keyed progress.
    value = {seenIds:model.roots.slice(0,Math.max(0,legacy.unlockedCount)).map(c => c.id),
      lastUnlockDay:legacy.lastUnlockDay,currentId:legacy.currentId};
  }
  const seen = new Set();
  if (validDay(value.lastUnlockDay) && Array.isArray(value.seenIds)) {
    for (const id of value.seenIds) {
      const card = model.byId.get(id);
      if (card && !seen.has(id) && eligible(card,seen,model)) seen.add(id);
    }
  }
  const seenIds = [...seen];
  return {versionId,seenIds,lastUnlockDay:seenIds.length ? value.lastUnlockDay : null,
    currentId:seen.has(value.currentId) ? value.currentId : seenIds.at(-1) || null};
}

export function treeFrontier(review, model) {
  const seen = new Set(review.seenIds);
  return model.cards.filter(c => !seen.has(c.id) && eligible(c,seen,model));
}

export function hasLeaf(today, budget) {
  return leafBalance(today,budget) > 0;
}

export function openTreeCard(saved, model, versionId, cardId, today, budget) {
  const review = restoreTreeReview(saved,model,versionId), card = model.byId.get(cardId);
  const wallet = restoreWallet(budget,today,budget || review);
  if (!card) return {review,wallet,spent:false};
  if (review.seenIds.includes(cardId)) return {review:{...review,currentId:cardId},wallet,spent:false};
  if (!treeFrontier(review,model).some(c => c.id === cardId)) return {review,wallet,spent:false};
  const payment = spendLeaf(wallet,today);
  if (!payment.spent) return {review,...payment};
  return {review:{...review,seenIds:[...review.seenIds,cardId],currentId:cardId,lastUnlockDay:today},...payment};
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
    const done = started.some(v => reviews[v.id].seenIds.length === v.cardCount);
    const ongoing = started.some(v => reviews[v.id].seenIds.length < v.cardCount);
    return [book.id,{reviewStatus:done ? "reviewed" : ongoing ? "reviewing" : "none",hasReviewed:done,hasReviewing:ongoing}];
  }));
}
export function canChangeDeckLanguage(catalog,versionId,userId) {
  const version=catalog.versionsById.get(versionId),deck=catalog.decksById.get(version?.deckId);
  return !!userId && deck?.creator.userId === userId && version?.status === "draft" &&
    catalog.versions.every(item=>item.deckId !== deck.id || item.status === "draft");
}
