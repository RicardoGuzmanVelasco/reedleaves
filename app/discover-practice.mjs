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

/** Sort by level first, then use the shared per-card frequency lottery within each level. */
export function selectDiscoverPracticeCards(cards,books,preferences,shelfBookIds,answers={},count=5,random=Math.random) {
  const levels=discoverPracticeLevels(cards,books,preferences,shelfBookIds),required=Math.max(0,Math.floor(count));
  const available=levels.reduce((total,level)=>total+level.length,0),selected=[];
  for(const level of levels) {
    const remaining=required-selected.length;
    if(!remaining) break;
    selected.push(...selectPracticeCards(level,answers,remaining,random));
  }
  return {selected,available,required};
}
