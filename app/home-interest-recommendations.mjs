import {compareBooksByInterestAffinity,detectUninterestingBook} from "./book-interest-affinity.mjs";

const HOME_RECOMMENDATION_LIMIT=3;

/** Pick up to three unique books, exhausting unread candidates before read books. */
export function homeInterestRecommendations(catalog,statuses={},preferences={},excludedBookIds=[]) {
  if(!catalog?.books)return [];
  const excluded=new Set(excludedBookIds);
  const candidates=catalog.books.filter(book=>!excluded.has(book.id));
  const unread=candidates.filter(book=>statuses[book.id]!=="read");
  const read=candidates.filter(book=>statuses[book.id]==="read");
  const selected=[];
  for(const pool of [unread,read]){
    const interested=[],detected=[],other=[];
    for(const book of pool){
      if(detectUninterestingBook(book,preferences))detected.push(book);
      else if(book.genres?.some(id=>preferences.interested?.includes(id)))interested.push(book);
      else other.push(book);
    }
    for(const group of [interested,detected,other]){
      group.sort((left,right)=>compareBooksByInterestAffinity(left,right,preferences));
      for(const book of group){
        if(selected.length===HOME_RECOMMENDATION_LIMIT)return selected;
        selected.push(book);
      }
    }
  }
  return selected;
}
