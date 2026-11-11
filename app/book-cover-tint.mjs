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
  const boundaries=chosen.length===2?[65]:chosen.length===3?[50,80]:chosen.slice(1).map((_,index)=>50+index*50/(chosen.length-1));
  const stops=[{color:chosen[0],position:0}];
  for(const [index,boundary] of boundaries.entries()){
    const previous=boundaries[index-1]??0,next=boundaries[index+1]??100;
    const halfWidth=Math.min(7,(boundary-previous)/2,(next-boundary)/2);
    stops.push({color:chosen[index],position:boundary-halfWidth},{color:chosen[index+1],position:boundary+halfWidth});
  }
  stops.push({color:chosen.at(-1),position:100});
  const gradient=amount=>`linear-gradient(to bottom, ${stops.map(({color,position})=>`color-mix(in srgb, ${color} ${amount}%, #fffdf6) ${position}%`).join(', ')})`;
  return {cover:gradient(38),dark:gradient(70),horizontal:gradient(38).replace('to bottom','to right'),horizontalDark:gradient(70).replace('to bottom','to right')};
}

export function mountBookCoverTints(root,books,interests,mode){
  const byId=new Map((books||[]).map(book=>[book.id,book]));
  for(const element of root.querySelectorAll('.book-tile[data-book], .book-spine[data-book]')){
    const tint=coverTintGradients(byId.get(element.dataset.book),interests,mode);
    if(tint){element.style.setProperty('--tinted-cover',tint.cover);element.style.setProperty('--tinted-spine',tint.dark);element.style.setProperty('--tinted-horizontal',tint.horizontal);element.style.setProperty('--tinted-horizontal-dark',tint.horizontalDark);element.dataset.tintedCover='true';}
    else {element.style.removeProperty('--tinted-cover');element.style.removeProperty('--tinted-spine');element.style.removeProperty('--tinted-horizontal');element.style.removeProperty('--tinted-horizontal-dark');delete element.dataset.tintedCover;}
  }
}
