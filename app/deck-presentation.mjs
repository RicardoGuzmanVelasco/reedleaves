// Reading presentation only: no learning state or account mutations.
export function presentationTarget(index,count,dx,width){
  const threshold=Math.min(100,Math.max(48,width*.22));
  return Math.max(0,Math.min(count-1,index+(dx<=-threshold?1:dx>=threshold?-1:0)));
}
export function mountDeckPresentation(root,{onSelect,onClose}={}){
  const screen=root.querySelector('[data-deck-presentation]');
  if(!screen)return ()=>{};
  const flight=screen.querySelector('[data-presentation-flight]');
  const strip=screen.querySelector('.presentation-thumbnails');
  const selected=strip?.querySelector('[aria-pressed="true"]');
  if(selected)strip.scrollLeft=Math.max(0,selected.offsetLeft-(strip.clientWidth-selected.clientWidth)/2);
  const index=Number(screen.dataset.index),count=Number(screen.dataset.count);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let gesture=null,timer=0,disposed=false,departing=false;
  const listeners=[];
  const listen=(target,type,callback,options)=>{target?.addEventListener(type,callback,options);if(target)listeners.push(()=>target.removeEventListener(type,callback,options));};
  function release(){
    if(gesture&&flight?.hasPointerCapture?.(gesture.id))flight.releasePointerCapture(gesture.id);
    gesture=null;if(flight)delete flight.dataset.dragging;
  }
  function reset(){if(flight){flight.style.transition=reduced?'none':'transform 240ms cubic-bezier(.2,.8,.3,1)';flight.style.transform='';}release();}
  listen(flight,'pointerdown',event=>{
    if(departing||event.isPrimary===false||event.button!==0||event.target.closest('a,button,input,select,textarea'))return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,active:false};flight.style.transition='none';
  });
  listen(flight,'pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.active){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){release();return;}
      if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return;
      gesture.active=true;flight.dataset.dragging="true";flight.setPointerCapture?.(gesture.id);
    }
    event.preventDefault();
    const edge=index===0&&dx>0||index===count-1&&dx<0;
    const resisted=dx*(edge?.16:.62)/(1+Math.abs(dx)/1000);
    flight.style.transform=`translateX(${resisted}px) rotate(${Math.max(-3,Math.min(3,resisted/70))}deg)`;
  },{passive:false});
  listen(flight,'pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    if(!gesture.active){release();return;}
    const dx=event.clientX-gesture.x,width=flight.getBoundingClientRect().width;
    const target=presentationTarget(index,count,dx,width);
    if(target===index){reset();return;}
    departing=true;release();flight.style.transition=reduced?'none':'transform 160ms ease-in';
    flight.style.transform=reduced?'':`translateX(${dx<0?-width:width}px)`;
    timer=setTimeout(()=>{if(!disposed)onSelect?.(target);},reduced?0:160);
  });
  listen(flight,'pointercancel',reset);
  listen(screen,'keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();onClose?.();return;}
    if(!flight||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const next=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:null;
    if(next===null)return;event.preventDefault();if(next>=0&&next<count)onSelect?.(next);
  });
  return ()=>{disposed=true;clearTimeout(timer);release();listeners.forEach(dispose=>dispose());};
}
