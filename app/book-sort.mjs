import {sortBooksByRecent} from "./catalog-incorporation.mjs";
import {bookTitle} from "./core.mjs";

export const BOOK_SORT_ORDERS=["recent","alphabetical"];
export const validBookSortOrder=value=>BOOK_SORT_ORDERS.includes(value);

const normalizedTitle=(book,language)=>bookTitle(book,language).text.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase(language);

export function sortBooks(books,order="recent",language="es") {
  if(order!=="alphabetical")return sortBooksByRecent(books);
  return books.map((book,index)=>({book,index,title:normalizedTitle(book,language)}))
    .sort((left,right)=>left.title.localeCompare(right.title,language,{sensitivity:"base",numeric:true})||left.index-right.index)
    .map(({book})=>book);
}
