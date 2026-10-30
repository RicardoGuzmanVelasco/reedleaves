import {detectUninterestingBook} from "./book-interest-affinity.mjs";
import {selectPracticeCards} from "./practice-progress.mjs";

export const DISCOVER_PRACTICE_LEVELS=6;

/** Return six disjoint priority levels, deduplicated by card ID. */
export function discoverPracticeLevels(cards,books,preferences,shelfBookIds=[]) {
  const booksById=books instanceof Map?books:new Map((books||[]).map(book=>[book.id,book]));
  const interested=new Set(Array.isArray(preferences?.interested)?preferences.interested:[]);
  const shelf=new Set(shelfBookIds),levels=Array.from({length:DISCOVER_PRACTICE_LEVELS},()=>[]),seen=new Set();
  for(const card of cards||[]) {
    if(!card?.id||seen.has(card.id)) continue;
    seen.add(card.id);
    const book=booksById.get(card.bookId);
    if(!book) continue;
    const related=(book.genres||[]).some(id=>interested.has(id)),unfavorable=!!detectUninterestingBook(book,preferences),inShelf=shelf.has(book.id);
    const level=(inShelf?3:0)+(related?(unfavorable?1:0):2);
    levels[level].push(card);
  }
  return levels;
}

/** Prefer one book at a time while respecting the six recommendation levels. */
export function selectDiscoverPracticeCards(cards,books,preferences,shelfBookIds,answers={},count=5,random=Math.random) {
  const levels=discoverPracticeLevels(cards,books,preferences,shelfBookIds),required=Math.max(0,Math.floor(count));
  const available=levels.reduce((total,level)=>total+level.length,0),selected=[];
  const selectedIds=new Set(),selectedBooks=new Set(),bookKey=card=>card.bookId??card.id;

  // Walk the recommendation tiers and take at most one card per book first.
  for(const level of levels) {
    const remaining=required-selected.length;
    if(!remaining) break;
    const newBooks=level.filter(card=>!selectedBooks.has(bookKey(card)));
    const bookCount=new Set(newBooks.map(bookKey)).size;
    if(!bookCount) continue;
    const batch=selectPracticeCards(newBooks,answers,Math.min(remaining,bookCount),random);
    for(const card of batch) {
      selected.push(card);selectedIds.add(card.id);selectedBooks.add(bookKey(card));
    }
  }

  // If there are fewer eligible books than places in the session, fill the
  // remaining places from the same recommendation tiers, preferring decks.
  for(const level of levels) {
    const remaining=required-selected.length;
    if(!remaining) break;
    const candidates=level.filter(card=>!selectedIds.has(card.id));
    for(const card of selectPracticeCards(candidates,answers,remaining,random)) {
      selected.push(card);selectedIds.add(card.id);
    }
  }
  return {selected,available,required};
}
