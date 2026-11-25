// Gestures of the card view (tarjetas.mjs) and the little leaves of rating and saving.
// Drag: left = next, right = previous (the content follows the finger), down = go deeper, up = back to the parent card.
// While dragging, the bar's button that will act fills with the theme's colour; under the threshold everything goes back.

// Distances (px) at which a drag acts, and the slop before it picks an axis.
export const SWIPE={horizontal:90,vertical:80,slop:10};

// Pure: the direction a drag of (dx,dy) means on `axis` ("x" | "y") and how far it went towards acting (0–1).
export function swipeIntent(dx,dy,axis){
  if(axis==="x"&&dx)return {direction:dx<0?"next":"prev",progress:Math.min(1,Math.abs(dx)/SWIPE.horizontal)};
  if(axis==="y"&&dy)return {direction:dy>0?"down":"up",progress:Math.min(1,Math.abs(dy)/SWIPE.vertical)};
  return {direction:null,progress:0};
}
// Pure: the axis a drag takes once it leaves the slop, or null while it is still a tap.
export const swipeAxis=(dx,dy)=>Math.max(Math.abs(dx),Math.abs(dy))<SWIPE.slop?null:Math.abs(dx)>=Math.abs(dy)?"x":"y";

const BUTTON={prev:"card-prev",next:"card-next",down:"card-down",up:"card-up"};
// The bar's button of a direction (the parent chip shares «card-up»: the bar's one is in the nav).
const buttonFor=(root,direction)=>root.querySelector(`.tc-nav [data-ui2="${BUTTON[direction]}"]`);

/**
 * Drag on the card of the stage ([data-ui2-stage]), delegated on `root`, which is painted again on each card.
 * @param {HTMLElement} root
 * @param {{can:(direction:string)=>boolean,go:(direction:string)=>void,win?:Window}} o
 * `can` tells whether there is a card that way (otherwise the drag resists and nothing fills); `go` moves.
 * Optional, for the Repaso session: `progress(direction,p)` follows the drag (null, 0 when it ends) and `tap(event)` gets a tap
 * on the stage (a press that never left the slop) that is not on a control; `arm(direction)` names the button that fills
 * instead of the bar's (the answers of a Repaso test), or null/undefined for the bar's.
 */
export function mountCardSwipe(root,{can,go,progress=()=>{},tap=()=>{},arm=()=>null,win=window}){
  let drag=null;
  const reset=()=>{
    if(!drag)return;
    const {card,armed}=drag;drag=null;progress(null,0);
    if(armed){armed.classList.remove("is-armed");armed.style.removeProperty("--p");}
    if(card){card.classList.remove("is-dragging");card.style.removeProperty("transform");}
  };
  root.addEventListener("pointerdown",event=>{
    const stage=event.target.closest?.("[data-ui2-stage]");
    if(!stage||event.button!==0||drag)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,axis:null,intent:null,card:stage.querySelector(".tc"),armed:null,stage};
    // Long content scrolls the screen vertically (.is-scroll, touch-action): only the horizontal drag is ours then.
    drag.scrolls=stage.classList.contains("is-scroll");
    try{stage.setPointerCapture(event.pointerId);}catch{/* The drag works without capture. */}
  });
  root.addEventListener("pointermove",event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    drag.axis??=swipeAxis(dx,dy);
    if(!drag.axis)return;
    if(drag.axis==="y"&&drag.scrolls){reset();return;}
    const intent=swipeIntent(dx,dy,drag.axis),able=!!intent.direction&&can(intent.direction);
    drag.intent=able?intent:null;
    // Where there is nothing, the card barely moves and no button fills.
    const pull=able?1:.25,reduced=!!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if(drag.card&&!reduced){
      drag.card.classList.add("is-dragging");
      drag.card.style.transform=drag.axis==="x"?`translateX(${dx*pull}px) rotate(${dx*pull/30}deg)`:`translateY(${dy*pull*.5}px) scale(${1-Math.min(.04,Math.abs(dy)/2000)})`;
    }
    const button=able?arm(intent.direction)||buttonFor(root,intent.direction):null;
    if(drag.armed&&drag.armed!==button){drag.armed.classList.remove("is-armed");drag.armed.style.removeProperty("--p");}
    drag.armed=button;
    if(button){button.classList.add("is-armed");button.style.setProperty("--p",`${Math.round(intent.progress*100)}%`);}
    progress(able?intent.direction:null,able?intent.progress:0);
  });
  const end=event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const intent=drag.intent,tapped=!drag.axis;reset();
    if(event.type!=="pointerup")return;
    if(intent?.progress>=1)go(intent.direction);
    else if(tapped&&!event.target.closest?.("button,a,input,textarea,select"))tap(event);
  };
  root.addEventListener("pointerup",end);
  root.addEventListener("pointercancel",end);
}

// Six leaves (the sprouts of the card back, app/assets/brand/card-back.svg) burst from a button in the theme's colour.
// They live in <body>, so the repaint that follows the action does not cut them. Nothing with reduced motion.
const LEAF='<path d="M0 10V0M0 1C-7 1-10-3-10-8 0-8 0-2 0 1ZM0-2C0-8 4-11 10-11 10-5 6-2 0-2Z"/>';
export function burstLeaves(button,{color,doc=document,win=window}={}){
  if(!button||win.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return null;
  const rect=button.getBoundingClientRect(),burst=doc.createElement("span");
  burst.className="tc-leaves";burst.setAttribute("aria-hidden","true");
  burst.innerHTML=Array.from({length:6},()=>`<svg viewBox="-12 -13 24 25" focusable="false">${LEAF}</svg>`).join("");
  burst.style.left=`${rect.left+rect.width/2}px`;burst.style.top=`${rect.top+rect.height/2}px`;
  if(color)burst.style.setProperty("--interest-color",color);
  doc.body.append(burst);
  const done=()=>burst.remove();
  burst.lastElementChild.addEventListener("animationend",done,{once:true});
  win.setTimeout(done,1400);
  return burst;
}

// Fitted type: the card's text takes the room between the header and the bar. The body size (--fs) is the largest that keeps the
// whole screen without scrolling, between a legible minimum and a maximum per type (little text does not grow without end).
// When even the minimum does not fit, the screen scrolls (long guides).
export const FIT={min:15,max:{idea:24,quote:30,"reading-guide":22}};

// Pure: the largest size in [min,max] (steps of `step`) for which `fits(size)` holds; `min` when none does.
export function largestFitting({min,max,fits,step=.5}){
  if(fits(max))return max;
  let low=min,high=max;
  while(high-low>step){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
  return Math.floor(low/step)*step;
}

export function fitCardText(screen){
  const card=screen?.querySelector(".tc");if(!card)return null;
  const type=["quote","reading-guide"].find(name=>card.classList.contains(`tc--${name}`))||"idea";
  const fits=size=>{card.style.setProperty("--fs",`${size}px`);return screen.scrollHeight<=screen.clientHeight+1;};
  // The entry movement would count as overflow while it is measured: it restarts right after.
  card.style.animation="none";
  const size=largestFitting({min:FIT.min,max:FIT.max[type],fits});
  card.style.setProperty("--fs",`${size}px`);card.style.removeProperty("animation");
  return size;
}
