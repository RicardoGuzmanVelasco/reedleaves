import {validInterestColor} from './interests.mjs';

export const coverTintModes=['off','mono','poly'];
export const coverTintMode=value=>coverTintModes.includes(value)?value:'off';

// Stops place the most important interest over the largest part of the cover.
export function coverTintGradients(book,interests,mode){
  if(coverTintMode(mode)==='off')return null;
  const byId=new Map((interests||[]).map(interest=>[interest.id,interest.color]));
  const colors=(book?.genres||[]).map(id=>byId.get(id)).filter(validInterestColor);
  if(!colors.length)return null;
  const chosen=mode==='mono'?colors.slice(0,1):colors;
  const positions=chosen.length===1?[0]:chosen.length===2?[0,30,100]:[0,40,...chosen.slice(1).map((_,index)=>Math.round(60+40*index/(chosen.length-2)))];
  const sequence=chosen.length>1?[chosen[0],...chosen]:chosen;
  const stops=sequence.map((color,index)=>({color,position:positions[index]}));
  const gradient=amount=>`linear-gradient(to bottom, ${stops.map(({color,position})=>`color-mix(in srgb, ${color} ${amount}%, #fffdf6) ${position}%`).join(', ')})`;
  // A duplicated stop makes the single-color case a valid CSS gradient.
  if(stops.length===1)stops.push({...stops[0],position:100});
  return {cover:gradient(38),dark:gradient(70)};
}

export function mountBookCoverTints(root,books,interests,mode){
  const byId=new Map((books||[]).map(book=>[book.id,book]));
  for(const element of root.querySelectorAll('.study-book[data-book], .book-spine[data-book]')){
    const tint=coverTintGradients(byId.get(element.dataset.book),interests,mode);
    if(tint){element.style.setProperty('--tinted-cover',tint.cover);element.style.setProperty('--tinted-spine',tint.dark);element.dataset.tintedCover='true';}
    else {element.style.removeProperty('--tinted-cover');element.style.removeProperty('--tinted-spine');delete element.dataset.tintedCover;}
  }
}
