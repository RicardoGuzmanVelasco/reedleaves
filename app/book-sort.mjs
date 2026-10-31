import {sortBooksByRecent} from "./catalog-incorporation.mjs";
import {bookTitle} from "./core.mjs";
import {sortBooksByInterestAffinity} from "./book-interest-affinity.mjs";

export const BOOK_SORT_ORDERS=["recent","alphabetical","interests"];
export const validBookSortOrder=value=>BOOK_SORT_ORDERS.includes(value);
export const LIBRARY_SORT_ORDERS=BOOK_SORT_ORDERS;
export const validLibrarySortOrder=value=>LIBRARY_SORT_ORDERS.includes(value);
export const validVisitorBookSortOrder=value=>value==="recent"||value==="alphabetical";
export const requiresInterestSortSignIn=(order,userId)=>order==="interests"&&!userId;
export const shouldLoadInterestPreferences=({mode,order,userId,preferences})=>mode==="library"&&order==="interests"&&!!userId&&preferences?.userId!==userId;

const normalizedTitle=(book,language)=>bookTitle(book,language).text.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase(language);

export function sortBooks(books,order="recent",language="es",interestPreferences) {
  if(order==="interests")return sortBooksByInterestAffinity(books,interestPreferences);
  if(order!=="alphabetical")return sortBooksByRecent(books);
  return books.map((book,index)=>({book,index,title:normalizedTitle(book,language)}))
    .sort((left,right)=>left.title.localeCompare(right.title,language,{sensitivity:"base",numeric:true})||left.index-right.index)
    .map(({book})=>book);
}
