import {compareBooksByInterestAffinity,detectUninterestingBook} from "./book-interest-affinity.mjs";

export const DEFAULT_BOOK_RECOMMENDATION_LIMIT=3;

/** Rank unique books by reading state and interest affinity for any recommendation surface. */
export function recommendBooks(catalog,statuses={},preferences={},excludedBookIds=[],limit=DEFAULT_BOOK_RECOMMENDATION_LIMIT) {
  if(!catalog?.books||!Number.isSafeInteger(limit)||limit<=0)return [];
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
        if(selected.length===limit)return selected;
        selected.push(book);
      }
    }
  }
  return selected;
}
