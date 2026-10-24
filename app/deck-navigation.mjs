export const deckPageHash=id=>'#review/'+encodeURIComponent(id);
export const deckReadingHash=id=>'#preview/'+encodeURIComponent(id);
export function deckShareUrl(currentUrl,id){
  const url=new URL(currentUrl);url.hash=deckReadingHash(id);return url.href;
}
