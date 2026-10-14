import test from "node:test";
import assert from "node:assert/strict";
import {startMascotBlinking,mascotBlinkTiming} from "./mascot-blink.mjs";
import {playMascotExpression} from "./mascot-face.mjs";

function fixture(randomValues = [0]) {
  let now=0,nextId=0,observer;
  const timers=new Map(),events=new Map(),motionEvents=new Map();
  const motion={matches:false,addEventListener:(name,fn)=>motionEvents.set(name,fn),removeEventListener:name=>motionEvents.delete(name)};
  const doc={hidden:false,documentElement:{},arts:[],defaultView:{matchMedia:()=>motion},
    querySelectorAll:()=>doc.arts,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
  const makeArt=({idle="float",face=true,expression="neutral"}={})=>{
    const classes=new Set(),animations=[];
    const art={isConnected:true,idle,face,expression,classes,animations,offsetWidth:100,
      classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name)},
      matches:()=>art.idle!=="none",querySelector:selector=>art.face && (!selector.includes("neutral") || art.expression==="neutral") ? {} : null,
      querySelectorAll:()=>[{getAnimations:()=>animations},{getAnimations:()=>animations}],getClientRects:()=>[{}]};
    doc.arts.push(art);return art;
  };
  const options={random:()=>randomValues.shift()??.5,
    setTimer:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,time:now+delay});return id},clearTimer:id=>timers.delete(id),
    Observer:class {constructor(callback){observer=this;this.callback=callback}observe(){}disconnect(){this.disconnected=true}}};
  function advance(ms) {
    const end=now+ms;
    while (true) {
      const next=[...timers].sort((a,b)=>a[1].time-b[1].time)[0];
      if (!next || next[1].time>end) break;
      now=next[1].time;timers.delete(next[0]);next[1].callback();
    }
    now=end;
  }
  return {doc,motion,timers,makeArt,options,advance,
    end:art=>events.get("animationend")({animationName:"mascot-eye-blink",target:{closest:()=>art}}),
    mutate:()=>observer.callback(),hide:value=>{doc.hidden=value;events.get("visibilitychange")()},
    reduce:value=>{motion.matches=value;motionEvents.get("change")()}};
}

test("Each mascot blinks briefly on an independent, newly random interval",()=>{
  const f=fixture([0,.75,.25]),a=f.makeArt(),b=f.makeArt();
  const stop=startMascotBlinking(f.doc,f.options);
  f.advance(2999);assert.equal(a.classes.size,0);
  f.advance(1);assert.ok(a.classes.has("is-auto-blinking"));assert.equal(b.classes.size,0);
  f.advance(mascotBlinkTiming.duration);f.end(a);assert.equal(a.classes.size,0);
  f.advance(2840);assert.ok(b.classes.has("is-auto-blinking"));assert.equal(a.classes.size,0);
  f.advance(160);f.end(b);assert.equal(b.classes.size,0);
  f.advance(1000);assert.ok(a.classes.has("is-auto-blinking"));
  stop();assert.equal(f.timers.size,0);assert.equal(a.classes.size,0);
});

test("Timeline mascots, faceless art and static expressions never auto-blink",()=>{
  const f=fixture();f.makeArt({idle:"none"});f.makeArt({face:false});f.makeArt({expression:"wink-left"});
  const stop=startMascotBlinking(f.doc,f.options);
  assert.equal(f.timers.size,0);stop();
});

test("Navigation removes old timers and detects newly rendered mascots without duplicate controllers",()=>{
  const f=fixture(),a=f.makeArt();const stop=startMascotBlinking(f.doc,f.options);
  assert.equal(startMascotBlinking(f.doc,f.options),stop);assert.equal(f.timers.size,1);
  a.isConnected=false;f.doc.arts=[];f.mutate();assert.equal(f.timers.size,0);
  const b=f.makeArt();f.mutate();assert.equal(f.timers.size,1);
  f.advance(5000);assert.ok(b.classes.has("is-auto-blinking"));
  b.idle="none";f.mutate();assert.equal(f.timers.size,0);assert.equal(b.classes.size,0);
  stop();
});

test("Hidden tabs and reduced motion cancel blinking and resume with a fresh wait",()=>{
  const f=fixture(),art=f.makeArt();const stop=startMascotBlinking(f.doc,f.options);
  f.advance(3000);assert.ok(art.classes.has("is-auto-blinking"));
  f.hide(true);assert.equal(f.timers.size,0);assert.equal(art.classes.size,0);
  f.hide(false);assert.equal(f.timers.size,1);
  f.reduce(true);assert.equal(f.timers.size,0);
  f.reduce(false);assert.equal(f.timers.size,1);
  stop();f.advance(10000);assert.equal(art.classes.size,0);
});

test("Explicit gestures take priority and do not change the body's idle state",()=>{
  const f=fixture([0,0]),art=f.makeArt();art.classes.add("is-generic-body-state");
  art.animations.push({playState:"running"});
  const stop=startMascotBlinking(f.doc,f.options);
  f.advance(3000);assert.ok(!art.classes.has("is-auto-blinking"));
  art.animations.length=0;f.advance(3000);assert.ok(art.classes.has("is-auto-blinking"));
  assert.ok(playMascotExpression(art,"wink-right"));
  assert.ok(!art.classes.has("is-auto-blinking"));assert.ok(art.classes.has("is-winking-right"));
  f.advance(160);assert.ok(art.classes.has("is-winking-right"));assert.ok(art.classes.has("is-generic-body-state"));
  f.advance(80);assert.equal(f.timers.size,1);assert.ok(art.classes.has("is-winking-right"));
  assert.equal(art.idle,"float");stop();
});
