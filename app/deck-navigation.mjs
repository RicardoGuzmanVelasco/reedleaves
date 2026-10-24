export const deckPageHash=id=>'#review/'+encodeURIComponent(id);
export const deckReadingHash=(id,layout='list')=>'#preview/'+encodeURIComponent(id)+(layout==='carousel'?'/carousel':'');
export function deckShareUrl(currentUrl,id){
  const url=new URL(currentUrl);url.hash=deckReadingHash(id);return url.href;
}
