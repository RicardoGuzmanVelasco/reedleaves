import test from "node:test";
import assert from "node:assert/strict";
import {createPracticePresentation} from "./practice-presentation.mjs";

const flush = async () => { for(let i=0;i<15;i++)await Promise.resolve(); };
function fixture({reduced=false,hidden=false}={}) {
  const doc=new EventTarget();doc.hidden=hidden;
  const motion=new EventTarget();motion.matches=reduced;
  const pending=new Set(),readingCalls=[];
  function element(dataset={}) {
    const attributes=new Map(),classes=new Set();
    const el={dataset,style:{},hidden:false,disabled:false,inert:false,
      setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),getAttribute:k=>attributes.get(k),
      classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k),contains:k=>classes.has(k)},
      animate:()=>{
        let resolve,reject;
        const animation={finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
          complete:()=>{pending.delete(animation);resolve();},
          cancel:()=>{pending.delete(animation);reject(new Error("cancelled"));}};
        pending.add(animation);return animation;
      }};
    return el;
  }
  const controller=createPracticePresentation({window:{matchMedia:()=>motion},document:doc,presentReading:(...args)=>readingCalls.push(args)});
  function mount(remaining=5) {
    const root=element({practiceRemaining:String(remaining)}),front=element(),flight=element();
    const buttons=[element({answer:"soon"}),element({answer:"remembered"})],backs=Array.from({length:9},()=>element());
    root.querySelector=selector=>selector===".practice-card-flight"?flight:front;
    root.querySelectorAll=selector=>selector.includes("practice-pile")?backs:buttons;
    const main={querySelector:()=>root};
    return {main,root,front,flight,buttons,backs};
  }
  const complete=async()=>{[...pending].forEach(a=>a.complete());await flush();};
  return {controller,mount,pending,readingCalls,complete,doc,motion,...mount()};
}

test("Preparation hides the card from reading and input until the turn reveals it",async()=>{
  const f=fixture();let ready=0;
  f.controller.present(f.main,{intro:true,onReady:()=>ready++});
  assert.equal(f.front.inert,true);assert.equal(f.front.getAttribute("aria-hidden"),"true");
  assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.readingCalls.length,0);
  await f.complete(); // Gather the pile.
  assert.equal(f.readingCalls.length,0);
  await f.complete(); // Cut away the surplus before revealing the first card.
  assert.equal(f.readingCalls.length,0);
  assert.equal(f.backs.filter(b=>!b.hidden).length,4);
  assert.ok(f.buttons.every(b=>b.disabled));
  await f.complete(); // Reverse reaches the edge of the turn.
  assert.equal(f.front.inert,false);assert.equal(f.readingCalls.length,1);
  assert.equal(ready,0);assert.ok(f.buttons.every(b=>b.disabled));
  await f.complete();
  assert.equal(ready,1);assert.ok(f.buttons.every(b=>!b.disabled));assert.equal(f.pending.size,0);
  assert.equal(f.backs.filter(b=>!b.hidden).length,4);
});

test("Unmounting during preparation or turning cancels continuations and cannot ready a later session",async()=>{
  for(const phase of ["preparation","cut","turning","front"]){
    const f=fixture();let staleReady=0,newReady=0;
    f.controller.present(f.main,{intro:true,onReady:()=>staleReady++});
    if(phase!=="preparation")await f.complete();
    if(phase==="turning"||phase==="front")await f.complete();
    if(phase==="front")await f.complete();
    const next=f.mount(2);
    f.controller.present(next.main,{ready:true,onReady:()=>newReady++});
    await flush();
    assert.equal(staleReady,0);assert.equal(newReady,1);assert.equal(f.pending.size,0);
    assert.equal(next.front.inert,false);assert.ok(next.buttons.every(b=>!b.disabled));
  }
});

test("Reduced motion and hidden documents skip the whole preparation and allow answering",async()=>{
  for(const options of [{reduced:true},{hidden:true}]){
    const f=fixture(options);let ready=0;
    f.controller.present(f.main,{intro:true,onReady:()=>ready++});
    assert.equal(ready,1);assert.equal(f.pending.size,0);assert.equal(f.readingCalls.length,1);
    assert.equal(f.front.inert,false);assert.ok(f.buttons.every(b=>!b.disabled));
  }
  for(const event of ["motion","visibility"]){
    const f=fixture();let ready=0;
    f.controller.present(f.main,{intro:true,onReady:()=>ready++});
    await f.complete();await f.complete();
    if(event==="motion"){f.motion.matches=true;f.motion.dispatchEvent(new Event("change"));}
    else {f.doc.hidden=true;f.doc.dispatchEvent(new Event("visibilitychange"));}
    await flush();
    assert.equal(ready,1);assert.equal(f.pending.size,0);assert.equal(f.root.dataset.phase,"reading");
    assert.equal(f.flight.style.transform,"");assert.equal(f.front.inert,false);
  }
});

test("Departure locks duplicate answers, completes writing and resolves when navigation cancels it",async()=>{
  const f=fixture();
  f.controller.present(f.main,{ready:true});
  const departure=f.controller.leave("left");
  assert.ok(f.buttons.every(b=>b.disabled));
  assert.equal(f.buttons[0].classList.contains("is-selected"),true);
  assert.equal(f.buttons[1].classList.contains("is-selected"),false);
  assert.equal(f.readingCalls.length,2);
  f.controller.dispose();await departure;
  assert.equal(f.pending.size,0);
});

test("The last card has no fake remaining cards and rerendering a ready card does not replay",()=>{
  const f=fixture(),last=f.mount(1);
  f.controller.present(last.main,{ready:true});
  assert.ok(last.backs.every(b=>b.hidden));assert.equal(f.pending.size,0);
  f.controller.present(last.main,{ready:true});assert.equal(f.pending.size,0);
});
