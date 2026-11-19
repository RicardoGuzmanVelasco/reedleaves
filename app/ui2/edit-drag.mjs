// Drag a note by its handle in «Editar baraja» (pointer: touch, pen or mouse). While it is lifted, the
// root zone «Ninguna (nota raíz)» stays grey at the bottom of the screen; over a note, its upper or lower
// edge shows the insertion line (reorder) and its middle highlights it as the new parent. Dropping calls
// `onDrop(cardId,{targetId,where})` with where = before | after | inside, or {root:true}. `canTarget`
// says whether a note may receive it (never the note itself or its descendants). One listener set per
// editor root; markup is repainted by the caller after each change.
const START_PX=6,EDGE=.3,SCROLL_EDGE_PX=72,SCROLL_STEP_PX=14;

export function mountEditDrag(root,{onDrop,canTarget,win=window}){
  let drag=null;
  const doc=root.ownerDocument;
  const clear=()=>{
    if(!drag)return;
    cancelAnimationFrame(drag.frame);
    drag.line?.remove();
    for(const node of root.querySelectorAll(".ed-target,.ed-lift"))node.classList.remove("ed-target","ed-lift");
    const zone=root.querySelector("[data-ed-root]");if(zone){zone.hidden=true;zone.classList.remove("is-on");}
    root.querySelector("[data-ui2-editor]")?.classList.remove("is-dragging");
    if(drag.row)drag.row.style.removeProperty("transform");
    drag=null;
  };
  // Where the pointer is: the root zone, a note row (and which part of it) or nothing.
  function hit(x,y){
    const zone=root.querySelector("[data-ed-root]");
    if(zone&&!zone.hidden){const box=zone.getBoundingClientRect();if(y>=box.top&&y<=box.bottom&&x>=box.left&&x<=box.right)return {root:true};}
    const under=doc.elementFromPoint(x,y)?.closest?.("li[data-ed-id]");
    if(!under||!root.contains(under))return null;
    const targetId=under.dataset.edId;
    if(!canTarget(drag.id,targetId))return null;
    const box=under.querySelector(".ed-row").getBoundingClientRect(),part=(y-box.top)/box.height;
    return {targetId,where:part<EDGE?"before":part>1-EDGE?"after":"inside",row:under.querySelector(".ed-row")};
  }
  function show(target){
    drag.target=target;
    for(const node of root.querySelectorAll(".ed-target"))node.classList.remove("ed-target");
    root.querySelector("[data-ed-root]")?.classList.toggle("is-on",!!target?.root);
    if(!target||target.root||target.where==="inside"){drag.line.hidden=true;if(target?.where==="inside")target.row.closest("li").classList.add("ed-target");return;}
    const box=target.row.getBoundingClientRect(),host=root.querySelector(".ed-map").getBoundingClientRect();
    drag.line.hidden=false;
    drag.line.style.setProperty("top",`${(target.where==="before"?box.top-5:box.bottom+3)-host.top}px`);
    drag.line.style.setProperty("left",`${box.left-host.left}px`);
    drag.line.style.setProperty("width",`${box.width}px`);
  }
  function lift(){
    drag.lifted=true;
    root.querySelector("[data-ui2-editor]")?.classList.add("is-dragging");
    drag.row.classList.add("ed-lift");
    const zone=root.querySelector("[data-ed-root]");if(zone)zone.hidden=false;
    drag.line=doc.createElement("div");drag.line.className="ed-line";drag.line.hidden=true;drag.line.setAttribute("aria-hidden","true");
    root.querySelector(".ed-map")?.append(drag.line);
  }
  // Near the top or bottom edge the page scrolls, so a note can travel the whole outline.
  function scroll(){
    if(!drag?.lifted)return;
    const height=win.innerHeight;
    if(drag.y<SCROLL_EDGE_PX)win.scrollBy(0,-SCROLL_STEP_PX);
    else if(drag.y>height-SCROLL_EDGE_PX-80)win.scrollBy(0,SCROLL_STEP_PX);
    // Lifted a little up and right, so the note or line under the finger stays visible.
    drag.row.style.setProperty("transform",`translate(14px,${drag.y-drag.startY+(win.scrollY-drag.scroll0)-22}px) rotate(-2deg)`);
    show(hit(drag.x,drag.y));
    drag.frame=requestAnimationFrame(scroll);
  }
  root.addEventListener("pointerdown",event=>{
    const handle=event.target.closest?.("[data-ui2-drag]");
    if(!handle||event.button>0||drag)return;
    const row=handle.closest(".ed-row");
    drag={id:handle.dataset.ui2Drag,pointer:event.pointerId,row,startY:event.clientY,x:event.clientX,y:event.clientY,scroll0:win.scrollY,lifted:false,target:null,frame:0};
    try{handle.setPointerCapture?.(event.pointerId);}catch{/* A pointer that already ended has nothing to capture. */}
  });
  root.addEventListener("pointermove",event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    drag.x=event.clientX;drag.y=event.clientY;
    if(!drag.lifted&&Math.abs(drag.y-drag.startY)>START_PX){lift();drag.frame=requestAnimationFrame(scroll);}
    if(drag.lifted){event.preventDefault();show(hit(drag.x,drag.y));}
  });
  const end=event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const {id,lifted,target}=drag;
    clear();
    if(lifted&&target&&event.type==="pointerup")onDrop(id,target.root?{root:true}:{targetId:target.targetId,where:target.where});
  };
  root.addEventListener("pointerup",end);
  root.addEventListener("pointercancel",end);
  return {cancel:clear,get dragging(){return !!drag?.lifted;}};
}
