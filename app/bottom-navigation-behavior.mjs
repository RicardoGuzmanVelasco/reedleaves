// Scroll moves the navigation without changing the space reserved for page content.
export function startBottomNavigationBehavior(win=window,doc=document) {
  const nav=doc.getElementById("main-navigation");
  if (!nav) return ()=>{};
  const pieces=[...nav.querySelectorAll(".bottom-navigation-link")];
  const delays=[32,16,0,16,32];
  const springs=pieces.map(()=>({position:0,velocity:0,target:0}));
  let springFrame=0,springTime=0;
  const viewport=win.visualViewport;
  const reduced=win.matchMedia("(prefers-reduced-motion: reduce)");
  const touch=win.matchMedia("(any-pointer: coarse)");
  let lastY=position(),offset=0,keyboard=false,frame=0;
  let baseline=Math.max(win.innerHeight,viewport?.height||0),ignoreUntil=0;
  const listeners=[];
  function listen(target,type,callback,options) {
    target?.addEventListener(type,callback,options);
    if(target)listeners.push(()=>target.removeEventListener(type,callback,options));
  }
  function position() {
    // Clamp rubber banding at either end of Safari's document scroll.
    return Math.max(0,Math.min(win.scrollY,Math.max(0,doc.documentElement.scrollHeight-win.innerHeight)));
  }
  function travel() {
    return nav.getBoundingClientRect().height+Math.max(0,parseFloat(win.getComputedStyle(nav).bottom)||0)+32;
  }
  function editable() {
    const target=doc.activeElement;
    return !!target && !target.disabled && !target.readOnly && (target.isContentEditable || target.matches?.('textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])'));
  }
  function animate(time) {
    springFrame=0;
    const dt=Math.min(1/30,Math.max(1/240,(time-springTime)/1000||1/60));springTime=time;
    let moving=false;
    springs.forEach((spring,i)=>{
      spring.velocity+=(220*(spring.target-spring.position)-20*spring.velocity)*dt;
      spring.position+=spring.velocity*dt;
      if(Math.abs(spring.target-spring.position)<.15 && Math.abs(spring.velocity)<.4){spring.position=spring.target;spring.velocity=0}
      else moving=true;
      pieces[i].style.setProperty("--navigation-piece-offset",`${spring.position}px`);
    });
    if(moving)springFrame=win.requestAnimationFrame(animate);
  }
  function paint() {
    const distance=travel(),hidden=keyboard || offset>=distance;
    const pixels=keyboard?distance:reduced.matches?(offset>distance/2?distance:0):offset;
    nav.style.setProperty("--navigation-scroll-offset",`${pixels}px`);
    springs.forEach((spring,i)=>{
      // The same stagger reverses naturally: outer pieces return before the centre.
      const progress=Math.max(0,Math.min(1,(pixels-delays[i])/Math.max(1,distance-32)));
      spring.target=progress*distance;
      if(keyboard || reduced.matches || pixels===0&&win.performance.now()<ignoreUntil){
        spring.position=spring.target;spring.velocity=0;
        pieces[i].style.setProperty("--navigation-piece-offset",`${spring.position}px`);
      }
    });
    if(!springFrame && !keyboard && !reduced.matches && springs.some(spring=>spring.position!==spring.target)){
      springTime=win.performance.now();springFrame=win.requestAnimationFrame(animate);
    }
    nav.classList.toggle("is-scroll-hidden",hidden || reduced.matches&&pixels===distance);
    // A tabbed focus can reveal scroll-hidden navigation; the keyboard state is inert.
    nav.inert=keyboard;
  }
  function reveal() {
    offset=0;lastY=position();ignoreUntil=win.performance.now()+350;paint();
  }
  function scroll() {
    frame=0;
    const next=position(),delta=next-lastY;lastY=next;
    if(keyboard || nav.hidden || doc.body.classList.contains("is-practicing"))return;
    if(win.performance.now()<ignoreUntil || nav.contains(doc.activeElement)&&doc.activeElement?.matches?.(":focus-visible"))return;
    if(next<=24)offset=0;
    else offset=Math.max(0,Math.min(travel(),offset+delta*(delta<0?3:1)));
    paint();
  }
  function scheduleScroll() {if(!frame)frame=win.requestAnimationFrame(scroll)}
  function updateViewport() {
    const focused=editable(),height=viewport?.height??win.innerHeight;
    if(!focused)baseline=Math.max(win.innerHeight,height);
    const next=focused && (baseline-height>140 || baseline-win.innerHeight>140 || !viewport&&touch.matches);
    if(next!==keyboard){keyboard=next;offset=0;lastY=position()}
    paint();
  }
  function orientation() {baseline=Math.max(win.innerHeight,viewport?.height||0);reveal();updateViewport()}
  listen(win,"scroll",scheduleScroll,{passive:true});
  listen(win,"hashchange",reveal);
  listen(win,"resize",updateViewport,{passive:true});
  listen(win,"orientationchange",orientation);
  listen(viewport,"resize",updateViewport,{passive:true});
  listen(doc,"focusin",updateViewport);
  listen(doc,"focusout",()=>queueMicrotask(updateViewport));
  listen(nav,"focusin",reveal);
  listen(reduced,"change",paint);
  reveal();updateViewport();
  return ()=>{listeners.forEach(remove=>remove());if(frame)win.cancelAnimationFrame(frame);if(springFrame)win.cancelAnimationFrame(springFrame);pieces.forEach(piece=>piece.style.removeProperty("--navigation-piece-offset"));nav.style.removeProperty("--navigation-scroll-offset");nav.classList.remove("is-scroll-hidden");nav.inert=false};
}
