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
  const index=()=>Number(screen.dataset.index),count=Number(screen.dataset.count);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let gesture=null,timer=0,disposed=false,departing=false,arrival=null;
  const listeners=[];
  const listen=(target,type,callback,options)=>{target?.addEventListener(type,callback,options);if(target)listeners.push(()=>target.removeEventListener(type,callback,options));};
  function center(smooth){
    const selected=strip?.querySelector('[aria-pressed="true"]');
    if(!selected)return;
    const left=Math.max(0,Math.min(strip.scrollWidth-strip.clientWidth,selected.offsetLeft-(strip.clientWidth-selected.clientWidth)/2));
    if(smooth&&strip.scrollTo)strip.scrollTo({left,behavior:reduced?'instant':'smooth'});else strip.scrollLeft=left;
  }
  center(false);
  function release(){
    const old=gesture;gesture=null;
    if(old&&flight?.hasPointerCapture?.(old.id)){try{flight.releasePointerCapture(old.id);}catch{}}
    if(flight)delete flight.dataset.dragging;
  }
  function reset(){if(flight){flight.style.transition=reduced?'none':'transform 240ms cubic-bezier(.2,.8,.3,1)';flight.style.transform='';}release();}
  listen(flight,'dragstart',event=>event.preventDefault());
  listen(flight,'pointerdown',event=>{
    if(departing||event.isPrimary===false||event.button!==0||event.target.closest('a,button,input,select,textarea'))return;
    arrival?.cancel();arrival=null;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,active:false};flight.style.transition='none';
  });
  listen(flight,'pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.active){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){release();return;}
      if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return;
      gesture.active=true;flight.dataset.dragging='true';
      try{flight.setPointerCapture?.(gesture.id);}catch{reset();return;}
    }
    event.preventDefault();
    const edge=index()===0&&dx>0||index()===count-1&&dx<0;
    const resisted=dx*(edge ? .16 : .62)/(1+Math.abs(dx)/1000);
    flight.style.transform=`translateX(${resisted}px) rotate(${Math.max(-3,Math.min(3,resisted/70))}deg)`;
  },{passive:false});
  listen(flight,'pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    if(!gesture.active){release();return;}
    const dx=event.clientX-gesture.x,width=flight.getBoundingClientRect().width;
    const target=presentationTarget(index(),count,dx,width);
    if(target===index()){reset();return;}
    departing=true;release();
    timer=setTimeout(()=>{if(!disposed){departing=false;onSelect?.(target);}},0);
  });
  listen(flight,'pointercancel',reset);
  listen(flight,'lostpointercapture',()=>{if(gesture)reset();});
  listen(screen,'keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();onClose?.();return;}
    if(!flight||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const next=event.key==='ArrowRight'?index()+1:event.key==='ArrowLeft'?index()-1:null;
    if(next===null)return;event.preventDefault();if(next>=0&&next<count)onSelect?.(next);
  });
  const dispose=()=>{disposed=true;clearTimeout(timer);arrival?.cancel();release();listeners.forEach(remove=>remove());};
  dispose.refresh=(direction=0,previous=null,origin='',previousHeight=0)=>{
    clearTimeout(timer);departing=false;release();arrival?.cancel();arrival=null;
    if(flight){
      flight.style.transition='none';flight.style.transform='';flight.style.opacity='1';
      const incoming=flight.firstElementChild;
      if(!reduced&&direction&&previous&&incoming?.animate){
        previous.classList.add('presentation-outgoing');previous.setAttribute('aria-hidden','true');previous.inert=true;
        previous.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
        previous.querySelectorAll('[data-card-actions]').forEach(element=>element.removeAttribute('data-card-actions'));
        flight.append(previous);
        const distance=(flight.offsetWidth||flight.getBoundingClientRect().width)+16;
        const options={duration:340,easing:'cubic-bezier(.22,.75,.22,1)',fill:'both'};
        const outgoingAnimation=previous.animate([{transform:origin||'translateX(0)'},{transform:`translateX(${-direction*distance}px)`}],options);
        const incomingAnimation=incoming.animate([{transform:`translateX(${direction*distance}px)`},{transform:'translateX(0)'}],options);
        const heightAnimation=previousHeight?flight.animate([{height:previousHeight+'px'},{height:incoming.offsetHeight+'px'}],options):null;
        const transition={cancel(){outgoingAnimation.cancel();incomingAnimation.cancel();heightAnimation?.cancel();previous.remove();}};
        arrival=transition;
        Promise.allSettled([outgoingAnimation.finished,incomingAnimation.finished,...(heightAnimation?[heightAnimation.finished]:[])]).then(()=>{transition.cancel();if(arrival===transition)arrival=null;});
      }
    }
    center(true);
  };
  return dispose;
}
