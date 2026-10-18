const priority = answer => answer === "soon" ? 0 : answer === "remembered" ? 2 : 1;

// Cards marked "soon" lead the next session. New cards come next; remembered
// cards remain available after those. Random values keep each priority group mixed.
export function prioritizePracticeCards(cards,answers={},random=Math.random) {
  return cards.map(card=>({card,rank:priority(answers[card.id]),order:random()}))
    .sort((a,b)=>a.rank-b.rank||a.order-b.order)
    .map(item=>item.card);
}
