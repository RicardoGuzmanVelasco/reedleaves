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
  const selected=[];

  while(selected.length<targetCount) {
    const totalWeight=remaining.reduce((sum,item)=>sum+item.weight,0);
    let roll=unitRandom(random)*totalWeight;
    let index=remaining.length-1;
    for(let candidate=0;candidate<remaining.length;candidate++) {
      roll-=remaining[candidate].weight;
      if(roll<0) {
        index=candidate;
        break;
      }
    }
    selected.push(remaining.splice(index,1)[0].card);
  }

  return selected;
}
