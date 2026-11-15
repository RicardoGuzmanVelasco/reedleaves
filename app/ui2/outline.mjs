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

// Ideas, in outline order, except the note itself and everything below it (no cycles possible).
export function placementTargets(model,cardId,language){
  const excluded=descendantIds(model,cardId);excluded.add(cardId);
  const rows=[];
  const walk=(cards,depth)=>{
    for(const card of cards){
      if(excluded.has(card.id))continue;
      if(!card.isQuote)rows.push({id:card.id,title:textOf(card,language,"title"),depth});
      walk(model.children.get(card.id)||[],card.isQuote?depth:depth+1);
    }
  };
  walk(model.roots,0);
  return rows;
}

// Personal decks of the signed-in reader: the only ones the server lets them correct or reorder.
export function deckCapabilities(deck,userId){
  const personal=!!userId&&deck?.creator?.userId===userId&&(deck.contributionPolicy||"owner")==="owner";
  const inProgress=deck?.status==="in_progress";
  return {correct:personal,place:personal,takeBelow:personal&&inProgress};
}

export function noteCount(model){return {count:model.cards.length,max:MAX_CARDS_PER_DECK};}

export function parentOf(model,cardId){
  const parentId=model.byId.get(cardId)?.parentId??null;
  return parentId===null?null:model.byId.get(parentId);
}

export function ownDecks(catalog,userId){
  return catalog.decks.filter(deck=>deckCapabilities(deck,userId).place&&["in_progress","finished"].includes(deck.status));
}
