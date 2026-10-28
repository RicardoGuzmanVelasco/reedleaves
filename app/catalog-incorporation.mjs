// Catalog dates are UTC instants. Legacy books keep their rollout position and
// do not receive a guessed timestamp.
export function catalogBookIncorporationTimestamp(now = () => new Date()) {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError("Invalid catalog incorporation time");
  return value.toISOString();
}

export function validCatalogIncorporation(book) {
  if (!Number.isSafeInteger(book?.incorporationOrder) || book.incorporationOrder < 1) return false;
  if (book.incorporatedAt === null) return true;
  if (typeof book.incorporatedAt !== "string") return false;
  const timestamp=Date.parse(book.incorporatedAt);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === book.incorporatedAt;
}

export function sortBooksByRecent(books) {
  return books.map((book,index)=>({book,index})).sort((left,right)=>{
    const leftDate=left.book.incorporatedAt ? Date.parse(left.book.incorporatedAt) : NaN;
    const rightDate=right.book.incorporatedAt ? Date.parse(right.book.incorporatedAt) : NaN;
    const leftHasDate=Number.isFinite(leftDate),rightHasDate=Number.isFinite(rightDate);
    if(leftHasDate!==rightHasDate)return leftHasDate?-1:1;
    if(leftHasDate&&leftDate!==rightDate)return rightDate-leftDate;
    const leftOrder=Number.isSafeInteger(left.book.incorporationOrder)?left.book.incorporationOrder:null;
    const rightOrder=Number.isSafeInteger(right.book.incorporationOrder)?right.book.incorporationOrder:null;
    if(leftOrder!==null&&rightOrder!==null&&leftOrder!==rightOrder)return rightOrder-leftOrder;
    if(leftOrder!==null&&rightOrder===null)return -1;
    if(leftOrder===null&&rightOrder!==null)return 1;
    return String(right.book.id??"").localeCompare(String(left.book.id??""));
  }).map(({book})=>book);
}
