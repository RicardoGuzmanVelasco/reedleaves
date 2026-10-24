import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationTarget,mountDeckPresentation} from './deck-presentation.mjs';
import {deckReadingHash,deckShareUrl} from './deck-navigation.mjs';

test('Presentation has distinct entry layouts and dragging respects threshold and boundaries',()=>{
  assert.equal(deckReadingHash('deck','carousel'),'#preview/deck/carousel');
  assert.equal(deckShareUrl('https://reedleaves.com/app/#preview/deck/carousel','deck'),'https://reedleaves.com/app/#preview/deck');
  assert.equal(presentationTarget(2,7,-90,320),3);
  assert.equal(presentationTarget(2,7,90,320),1);
  assert.equal(presentationTarget(2,7,20,320),2);
  assert.equal(presentationTarget(0,7,180,320),0);
  assert.equal(presentationTarget(6,7,-180,320),6);
  assert.equal(presentationTarget(0,1,-180,320),0);
});
function element(dataset={}){
  const listeners=new Map();let capture=null;
  return {dataset,style:{},closest:()=>null,querySelector:()=>null,
    addEventListener(type,callback){const group=listeners.get(type)||new Set();group.add(callback);listeners.set(type,group);},
    removeEventListener(type,callback){listeners.get(type)?.delete(callback);},
    emit(type,values={}){const event={target:this,isPrimary:true,button:0,pointerId:1,preventDefault(){this.prevented=true;},...values};for(const callback of listeners.get(type)||[])callback(event);return event;},
    setPointerCapture(id){capture=id;},hasPointerCapture(id){return capture===id;},releasePointerCapture(){capture=null;},getBoundingClientRect:()=>({width:320})};
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,190));
test('Presentation distinguishes page scroll from drag, springs back and cancels pending navigation on disposal',async()=>{
  const root=element(),screen=element({index:'1',count:'3'}),flight=element();
  root.querySelector=()=>screen;screen.querySelector=selector=>selector==='[data-presentation-flight]'?flight:null;
  const selected=[];let closed=0;
  const dispose=mountDeckPresentation(root,{onSelect:index=>selected.push(index),onClose:()=>closed++});
  flight.emit('pointerdown',{clientX:150,clientY:100});
  const vertical=flight.emit('pointermove',{clientX:151,clientY:160});
  assert.ok(!vertical.prevented);flight.emit('pointerup',{clientX:20});await pause();assert.deepEqual(selected,[]);
  flight.emit('pointerdown',{clientX:150,clientY:100});flight.emit('pointermove',{clientX:120,clientY:102});flight.emit('pointerup',{clientX:120});
  assert.equal(flight.style.transform,'');assert.deepEqual(selected,[]);
  flight.emit('pointerdown',{clientX:200,clientY:100});flight.emit('pointermove',{clientX:60,clientY:102});flight.emit('pointerup',{clientX:60});
  dispose();await pause();assert.deepEqual(selected,[]);
  screen.emit('keydown',{key:'Escape'});assert.equal(closed,0);
});
test('Presentation supports drag, keyboard navigation and Escape without accepting duplicate departures',async()=>{
  const root=element(),screen=element({index:'1',count:'3'}),flight=element();
  root.querySelector=()=>screen;screen.querySelector=selector=>selector==='[data-presentation-flight]'?flight:null;
  const selected=[];let closed=0;const dispose=mountDeckPresentation(root,{onSelect:index=>selected.push(index),onClose:()=>closed++});
  screen.emit('keydown',{key:'ArrowLeft'});assert.deepEqual(selected,[0]);
  screen.emit('keydown',{key:'Escape'});assert.equal(closed,1);
  flight.emit('pointerdown',{clientX:200,clientY:100});flight.emit('pointermove',{clientX:60,clientY:102});flight.emit('pointerup',{clientX:60});
  flight.emit('pointerdown',{clientX:200,clientY:100});flight.emit('pointermove',{clientX:60,clientY:102});flight.emit('pointerup',{clientX:60});await pause();
  assert.deepEqual(selected,[0,2]);dispose();
});

test('Repeated swipes use the current selection without remounting the carousel',async()=>{
  const root=element(),screen=element({index:'1',count:'7'}),flight=element();
  root.querySelector=()=>screen;screen.querySelector=selector=>selector==='[data-presentation-flight]'?flight:null;
  const selected=[];
  const dispose=mountDeckPresentation(root,{onSelect:index=>{selected.push(index);screen.dataset.index=String(index);dispose.refresh(index);}});
  for(const dx of [-140,-140,140,-140]){
    flight.emit('pointerdown',{clientX:200,clientY:100});
    flight.emit('pointermove',{clientX:200+dx,clientY:102});
    flight.emit('pointerup',{clientX:200+dx});await pause();
    assert.equal(flight.style.transform,'');assert.equal(flight.style.opacity,'1');
  }
  assert.deepEqual(selected,[2,3,2,3]);dispose();
});

test('Incoming cards push the outgoing card in the chosen direction while height follows content',async()=>{
  for(const direction of [-1,1]){
    const root=element(),screen=element({index:'1',count:'3'}),flight=element();
    root.querySelector=()=>screen;screen.querySelector=selector=>selector==='[data-presentation-flight]'?flight:null;
    const animations=[];let removed=false;
    const animate=(frames,options)=>{animations.push({frames,options});return {finished:Promise.resolve(),cancel(){}};};
    const incoming={offsetHeight:230,animate},previous={animate,classList:{add(){}},setAttribute(){},querySelectorAll:()=>[],remove(){removed=true;}};
    flight.firstElementChild=incoming;flight.offsetWidth=320;flight.animate=animate;flight.append=()=>{};
    const dispose=mountDeckPresentation(root);
    dispose.refresh(direction,previous,'translateX(-30px)',450);
    assert.equal(animations[0].frames[1].transform,`translateX(${-direction*336}px)`);
    assert.equal(animations[1].frames[0].transform,`translateX(${direction*336}px)`);
    assert.deepEqual(animations[2].frames,[{height:'450px'},{height:'230px'}]);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    assert.equal(removed,true);dispose();
  }
});
