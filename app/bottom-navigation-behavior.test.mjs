import test from "node:test";
import assert from "node:assert/strict";
import {startBottomNavigationBehavior} from "./bottom-navigation-behavior.mjs";

function fixture({viewport=true,touch=false}={}) {
  const target=()=>{const events=new Map();return {addEventListener:(name,fn)=>{const set=events.get(name)||new Set();set.add(fn);events.set(name,set)},removeEventListener:(name,fn)=>events.get(name)?.delete(fn),emit:name=>events.get(name)?.forEach(fn=>fn())}};
  const classes=new Set(),styles=new Map(),frames=new Map();let now=500,id=0;
  const pieceStyles=Array.from({length:5},()=>new Map());
  const pieces=pieceStyles.map(style=>({style:{setProperty:(key,value)=>style.set(key,value),removeProperty:key=>style.delete(key)}}));
  const nav={...target(),querySelectorAll:()=>pieces,hidden:false,inert:false,getBoundingClientRect:()=>({height:117}),classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key),remove:key=>classes.delete(key)},style:{setProperty:(key,value)=>styles.set(key,value),removeProperty:key=>styles.delete(key)},contains:element=>element?.inNav===true};
  const reduced={...target(),matches:false},coarse={matches:touch};
  const doc={...target(),activeElement:null,documentElement:{scrollHeight:2400},body:{classList:{contains:()=>false}},getElementById:()=>nav};
  const win={...target(),scrollY:0,innerHeight:800,performance:{now:()=>now},visualViewport:viewport?{...target(),height:800}:null,matchMedia:query=>query.includes("reduced")?reduced:coarse,getComputedStyle:()=>({bottom:"14px"}),requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:key=>frames.delete(key)};
  const stop=startBottomNavigationBehavior(win,doc);now+=500;
  const offset=()=>parseFloat(styles.get("--navigation-scroll-offset"));
  const scroll=y=>{win.scrollY=y;win.emit("scroll");const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now))};
  const focus=element=>{doc.activeElement=element;doc.emit("focusin")};
  const field={matches:selector=>selector!==":focus-visible"};
  const tick=(count=1)=>{for(let i=0;i<count;i++){now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now))}};
  const positions=()=>pieceStyles.map(style=>parseFloat(style.get("--navigation-piece-offset")));
  return {win,doc,nav,reduced,styles,classes,frames,stop,scroll,offset,focus,field,tick,positions,advance:()=>{now+=500}};
}

test("Navigation follows downward scroll and returns faster on reversal without changing page layout",()=>{
  const f=fixture();f.scroll(12);assert.equal(f.offset(),0);
  f.scroll(60);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);
  f.scroll(120);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);
  f.scroll(100);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);
  f.scroll(80);assert.equal(f.offset(),0);
  f.scroll(500);assert.ok(f.classes.has("is-scroll-hidden"));assert.equal(f.nav.inert,false);
  f.scroll(470);assert.ok(!f.classes.has("is-scroll-hidden"));
  f.stop();assert.equal(f.styles.size,0);
});

test("Each route reveals navigation and ignores initial restoration scroll; overscroll does not cause false reversals",()=>{
  const f=fixture();f.scroll(200);f.win.emit("hashchange");assert.equal(f.offset(),0);
  f.scroll(600);assert.equal(f.offset(),0);
  f.advance();f.scroll(1600);assert.ok(f.classes.has("is-scroll-hidden"));
  f.scroll(1700);assert.ok(f.classes.has("is-scroll-hidden"));
  f.scroll(1600);assert.ok(f.classes.has("is-scroll-hidden"));
  f.scroll(1570);assert.ok(!f.classes.has("is-scroll-hidden"));
  f.scroll(-30);assert.equal(f.offset(),0);f.stop();
});

test("A virtual keyboard hides navigation only while editing and restores it when dismissed",()=>{
  const f=fixture();f.focus(f.field);assert.equal(f.nav.inert,false);
  f.win.visualViewport.height=470;f.win.visualViewport.emit("resize");assert.equal(f.nav.inert,true);
  assert.ok(f.classes.has("is-scroll-hidden"));f.scroll(200);assert.equal(f.nav.inert,true);
  f.win.visualViewport.height=800;f.win.visualViewport.emit("resize");assert.equal(f.nav.inert,false);assert.equal(f.offset(),0);
  // Browser chrome shrinking without an editor must not look like a keyboard.
  f.focus(null);f.win.visualViewport.height=500;f.win.visualViewport.emit("resize");assert.equal(f.nav.inert,false);f.stop();
});

test("Keyboard focus reveals the navigation; a pointer-selected tab does not prevent scroll hiding",()=>{
  const f=fixture();f.scroll(300);
  f.focus({inNav:true,matches:selector=>selector===":focus-visible"});f.nav.emit("focusin");assert.equal(f.offset(),0);
  f.advance();f.scroll(500);assert.equal(f.offset(),0);
  f.focus({inNav:true,matches:()=>false});f.scroll(600);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);f.stop();
});

test("Reduced motion changes visibility directly and cleanup removes scroll listeners",()=>{
  const f=fixture();f.reduced.matches=true;f.reduced.emit("change");
  f.scroll(30);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);f.scroll(150);assert.ok(f.classes.has("is-scroll-hidden"));
  f.stop();f.win.emit("scroll");assert.equal(f.frames.size,0);assert.equal(f.nav.inert,false);
});

test("Touch browsers without Visual Viewport still hide navigation while editing",()=>{
  const f=fixture({viewport:false,touch:true});f.focus(f.field);assert.equal(f.nav.inert,true);
  f.focus(null);assert.equal(f.nav.inert,false);f.stop();
});


test("Navigation settles at an endpoint after scrolling stops",()=>{
  const f=fixture();f.scroll(90);assert.equal(f.offset(),f.nav.getBoundingClientRect().height+14+32);
  f.tick(160);assert.ok(f.positions().every(value=>Math.abs(value-f.offset())<.2));
  f.scroll(60);f.tick(160);assert.ok(f.positions().every(value=>Math.abs(value)<.2));
  f.stop();assert.equal(f.frames.size,0);
});
