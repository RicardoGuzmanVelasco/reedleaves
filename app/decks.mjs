import {contentText,LANGUAGES} from './core.mjs';
import {defaultNoteDeckTitle} from './note-defaults.mjs';

const normalizedTitle=value=>value.trim().toLocaleLowerCase();
const automaticTitles=new Set(LANGUAGES.map(language=>normalizedTitle(defaultNoteDeckTitle(language))));

export function sortDecks(catalog,decks,{userId=null,language='es'}={}) {
  return decks.map((deck,index)=>{
    const cards=catalog.deckModels.get(deck.id)?.cards || [];
    const titles=[contentText(deck.title,deck.language,deck.language),contentText(deck.title,language,deck.language)].map(normalizedTitle);
    const priority=[
      !!deck.isRecommended || isReadingGuideDeck(catalog,deck),
      !!userId && cards.some(card=>card.creatorUserId===userId),
      !titles.some(title=>automaticTitles.has(title)),
      !titles.some(title=>/(?:^|[^\p{L}\p{N}])(?:notas|personales|notes|personal)(?:$|[^\p{L}\p{N}])/u.test(title))
    ];
    return {deck,index,priority};
  }).sort((a,b)=>{
    for(let i=0;i<a.priority.length;i++){
      const difference=Number(b.priority[i])-Number(a.priority[i]);
      if(difference)return difference;
    }
    return a.index-b.index;
  }).map(item=>item.deck);
}

export function isReadingGuideDeck(catalog,deck) {
  return !!deck && (catalog.deckModels.get(deck.id)?.cards.some(card=>card.isReadingGuide) || false);
}

export function availableDecks(catalog, bookId) {
  return catalog.decks.filter(deck => deck.bookId === bookId && deck.status !== "archived" && !isReadingGuideDeck(catalog,deck)).map(deck => ({deck,tags:[]}));
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
