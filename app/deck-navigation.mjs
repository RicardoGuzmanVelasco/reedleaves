export const deckPageHash=id=>'#deck/'+encodeURIComponent(id);
export const deckReadingHash=(id,layout='list')=>'#preview/'+encodeURIComponent(id)+(layout==='carousel'?'/carousel':'');
// The shared link always opens the deck to read (its cards), never its page or the editor, in the interface
// every reader has: without the `?ui=2` switch of the new one.
export function deckShareUrl(currentUrl,id){
  const url=new URL(currentUrl);url.searchParams.delete("sharedCard");url.searchParams.delete("cardLanguage");url.searchParams.delete("ui");url.hash=deckReadingHash(id);return url.href;
}

export function cardShareUrl(currentUrl,id,language){
  const url=new URL(currentUrl);url.pathname="/app/";url.search="";url.searchParams.set("sharedCard",id);url.searchParams.set("cardLanguage",language);url.hash=`#card/${encodeURIComponent(id)}/${encodeURIComponent(language)}`;return url.href;
}
