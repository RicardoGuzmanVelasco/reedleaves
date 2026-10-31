export function adjacentCard(cards,currentId,direction) {
  const index=cards.findIndex(card=>card.id===currentId);
  if(index<0)return null;
  const target=cards[index+Math.sign(direction)];
  return target?.id||null;
}

export function swipeStep(start,end,threshold=48) {
  const horizontal=end.x-start.x,vertical=end.y-start.y;
  if(Math.abs(horizontal)<threshold||Math.abs(horizontal)<=Math.abs(vertical)*1.2)return 0;
  return horizontal<0?1:-1;
}
