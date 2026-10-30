const weightForSavedAnswer = answer => answer === "soon" ? 0.5 : answer === "remembered" ? 2 : 1;
const unitRandom = random => {
  const value=random();
  return Number.isFinite(value) ? Math.min(1-Number.EPSILON,Math.max(0,value)) : 0;
};

// The stored answer names are legacy values. Keep their UI meaning and weight
// translation here so selection operates on cards, not response groups.
export function selectPracticeCards(cards,answers={},count=5,random=Math.random) {
  const targetCount=Math.min(cards.length,Math.max(0,Math.floor(count)));
  const remaining=cards.map(card=>({card,weight:weightForSavedAnswer(answers[card.id])}));
  const selected=[],selectedBooks=new Set(),selectedDecks=new Set();
  const bookKey=card=>card.bookId??card.id,deckKey=card=>card.deckId??card.id;

  while(selected.length<targetCount) {
    // Prefer a new book whenever one remains. If the reader has cards from
    // only a few books, use another deck before repeating a deck as well.
    const distinctBooks=remaining.filter(({card})=>!selectedBooks.has(bookKey(card)));
    const distinctDecks=remaining.filter(({card})=>!selectedDecks.has(deckKey(card)));
    const eligible=distinctBooks.length?distinctBooks:distinctDecks.length?distinctDecks:remaining;
    const totalWeight=eligible.reduce((sum,item)=>sum+item.weight,0);
    let roll=unitRandom(random)*totalWeight;
    let index=eligible.length-1;
    for(let candidate=0;candidate<eligible.length;candidate++) {
      roll-=eligible[candidate].weight;
      if(roll<0) {
        index=candidate;
        break;
      }
    }
    const chosen=eligible[index];
    const originalIndex=remaining.indexOf(chosen);
    const [{card}]=remaining.splice(originalIndex,1);
    selected.push(card);
    selectedBooks.add(bookKey(card));
    selectedDecks.add(deckKey(card));
  }

  return selected;
}
