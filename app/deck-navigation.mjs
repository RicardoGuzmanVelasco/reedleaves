export const deckPageHash=id=>'#review/'+encodeURIComponent(id);
export const deckReadingHash=(id,layout='list')=>'#preview/'+encodeURIComponent(id)+(layout==='carousel'?'/carousel':'');
export function deckShareUrl(currentUrl,id){
  const url=new URL(currentUrl);url.searchParams.delete("sharedCard");url.searchParams.delete("cardLanguage");url.hash=deckReadingHash(id);return url.href;
}

export function cardShareUrl(currentUrl,id,language){
  const url=new URL(currentUrl);url.pathname="/app/";url.search="";url.searchParams.set("sharedCard",id);url.searchParams.set("cardLanguage",language);url.hash=`#card/${encodeURIComponent(id)}/${encodeURIComponent(language)}`;return url.href;
}
