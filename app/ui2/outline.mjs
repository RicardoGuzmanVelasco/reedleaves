// Pure helpers for the new deck screen: the notes of one deck as an outline,
// the allowed parents for "Colocar debajo de" and what the reader may do.
import {MAX_CARDS_PER_DECK} from "../core.mjs";

const textOf=(card,language,field)=>card[field]?.[language]??Object.values(card[field]||{})[0]??"";

function node(model,card,language){
  return {id:card.id,isQuote:card.isQuote,title:textOf(card,language,"title"),body:textOf(card,language,"body"),
    children:(model.children.get(card.id)||[]).map(child=>node(model,child,language))};
}

// Ideas form the outline; root quotes have no idea above them and go to their own group.
export function deckOutline(model,language){
  const roots=model.roots.map(card=>node(model,card,language));
  return {tree:roots.filter(item=>!item.isQuote),unsorted:roots.filter(item=>item.isQuote)};
}

export function descendantIds(model,cardId){
  const ids=new Set(),stack=[...(model.children.get(cardId)||[])];
  while(stack.length){const card=stack.pop();ids.add(card.id);stack.push(...(model.children.get(card.id)||[]));}
  return ids;
}

// Notes (ideas and quotes), in outline order, except the note itself and everything below it (no cycles possible).
export function placementTargets(model,cardId,language){
  const excluded=descendantIds(model,cardId);excluded.add(cardId);
  const rows=[];
  const walk=(cards,depth)=>{
    for(const card of cards){
      if(excluded.has(card.id))continue;
      rows.push({id:card.id,title:textOf(card,language,card.isQuote?"body":"title"),depth});
      walk(model.children.get(card.id)||[],depth+1);
    }
  };
  walk(model.roots,0);
  return rows;
}

// Only the author of a personal deck in progress changes it; a finished deck is closed for good.
export function deckCapabilities(deck,userId){
  const personal=!!userId&&deck?.creator?.userId===userId&&(deck.contributionPolicy||"owner")==="owner";
  const open=personal&&deck?.status==="in_progress";
  return {edit:open,takeBelow:open};
}

export function noteCount(model){return {count:model.cards.length,max:MAX_CARDS_PER_DECK};}

export function parentOf(model,cardId){
  const parentId=model.byId.get(cardId)?.parentId??null;
  return parentId===null?null:model.byId.get(parentId);
}

const siblingsOf=(model,parentId)=>parentId===null?model.roots:model.children.get(parentId)||[];
// Siblings as the outline shows them: at the root, ideas first and then the unclassified quotes.
const shownSiblings=(model,parentId)=>{
  const siblings=siblingsOf(model,parentId);
  return parentId===null?[...siblings.filter(card=>!card.isQuote),...siblings.filter(card=>card.isQuote)]:siblings;
};
// The keyboard move of a note in the editor (its drag handle), by what is on screen: up/down passes the
// sibling above or below, right goes inside the sibling above (last), left goes out just after its parent.
// Returns {parentId,position} for /api/author/notes/move, or null when it cannot move that way.
export function keyboardMove(model,cardId,key){
  const card=model.byId.get(cardId);if(!card)return null;
  const siblings=shownSiblings(model,card.parentId),index=siblings.findIndex(item=>item.id===cardId);
  const above=siblings[index-1],below=siblings[index+1];
  if(key==="ArrowUp")return above?dropMove(model,cardId,above.id,"before"):null;
  if(key==="ArrowDown")return below?dropMove(model,cardId,below.id,"after"):null;
  if(key==="ArrowRight")return above?dropMove(model,cardId,above.id,"inside"):null;
  if(key==="ArrowLeft")return card.parentId===null?null:dropMove(model,cardId,card.parentId,"after");
  return null;
}

// Where a dragged note lands when it is dropped before or after another note, or inside it (last child).
// Positions count the new siblings without the note itself, as the server does. Null when it is not a
// valid destination: the note itself or one of its descendants.
export function dropMove(model,cardId,targetId,where){
  const card=model.byId.get(cardId),target=model.byId.get(targetId);
  if(!card||!target||targetId===cardId||descendantIds(model,cardId).has(targetId))return null;
  if(where==="inside"){
    const children=siblingsOf(model,targetId).filter(item=>item.id!==cardId);
    return {parentId:targetId,position:children.length+1};
  }
  const siblings=siblingsOf(model,target.parentId).filter(item=>item.id!==cardId);
  const index=siblings.findIndex(item=>item.id===targetId);
  return {parentId:target.parentId,position:index+(where==="after"?2:1)};
}
// The same move as the note's current place: dropping it there saves nothing.
export function isCurrentPlace(model,cardId,move){
  const card=model.byId.get(cardId);if(!card||!move)return true;
  const siblings=siblingsOf(model,card.parentId);
  return move.parentId===card.parentId&&move.position===siblings.findIndex(item=>item.id===cardId)+1;
}
