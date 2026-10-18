const priority = answer => answer === "soon" ? "soon" : answer === "remembered" ? "remembered" : "new";
const weights = {soon:3,new:2,remembered:1};

// Draw a priority by weight, then choose a random card from that group.
// Selected cards are removed, so a session never repeats a card.
export function selectPracticeCards(cards,answers={},count=5,random=Math.random) {
  const groups=new Map(["soon","new","remembered"].map(key=>[key,cards.filter(card=>priority(answers[card.id])===key)]));
  const selected=[];
  const targetCount=Math.min(cards.length,Math.max(0,Math.floor(count)));
  while(selected.length<targetCount) {
    const available=[...groups].filter(([,group])=>group.length);
    const totalWeight=available.reduce((sum,[key])=>sum+weights[key],0);
    let roll=Math.min(1-Number.EPSILON,Math.max(0,random()))*totalWeight;
    let selectedGroup=available.find(([key])=>(roll-=weights[key])<0)?.[1];
    if(!selectedGroup) selectedGroup=available.at(-1)?.[1];
    const index=Math.min(selectedGroup.length-1,Math.floor(Math.min(1-Number.EPSILON,Math.max(0,random()))*selectedGroup.length));
    selected.push(selectedGroup.splice(index,1)[0]);
  }
  return selected;
}
