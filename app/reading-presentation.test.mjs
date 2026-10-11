import test from "node:test";
import assert from "node:assert/strict";
import {createReadingPresentation} from "./reading-presentation.mjs";

// Minimal DOM/scheduler double, so lifecycle and accessibility are tested without timers.
class Element extends EventTarget {
  constructor(text = "") {
    super(); this.textContent = text; this.attributes = {}; this.children = [];
    const classes = new Set();
    this.classList = {add:(...items)=>items.forEach(item=>classes.add(item)),remove:(...items)=>items.forEach(item=>classes.delete(item)),contains:item=>classes.has(item),toggle:(item,on)=>on ? classes.add(item) : classes.delete(item)};
  }
  setAttribute(name,value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; this.textContent = children.map(child=>child.textContent).join(""); }
  focus() { this.focused = true; }
}
function fixture({text = "Una idea para recordar.", reduced = false, hidden = false} = {}) {
  const doc = new EventTarget(); doc.body = new Element(); doc.hidden = hidden;
  doc.createElement = ()=>new Element(); doc.createTextNode = text=>new Element(text);
  const motion = new EventTarget(); motion.matches = reduced;
  let id = 0; const frames = new Map();
  const win = {matchMedia:()=>motion,requestAnimationFrame:callback=>{ frames.set(++id,callback); return id; },cancelAnimationFrame:id=>frames.delete(id)};
  const present = createReadingPresentation({window:win,document:doc});
  function scene(cardId = "one", content = text) {
    const body = new Element(content), button = new Element("Mostrar texto completo"), title = new Element("Idea"); body.lang = "es";
    const stage = new Element("Idea"+content+button.textContent); stage.dataset = {readingCard:cardId};
    stage.querySelector = selector=>({".idea-body":body,".reveal-text":button,"#idea-content":title})[selector];
    return {stage,body,button,title};
  }
  const first = scene();
  const main = {querySelector:()=>main.stage}; main.stage = first.stage;
  const advance = time=>{ const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback=>callback(time)); };
  return {...first,main,present,scene,advance,frames,motion,doc,text};
}
test("Typing reserves complete text, exposes it once to readers, and never splits graphemes",()=>{
  const f=fixture({text:"e\u0301👩🏽‍🌾🌱"}); f.present(f.main);
  const [full,space,ink]=f.body.children;
  assert.equal(full.textContent,f.text); assert.equal(full.className,"sr-only");
  assert.equal(space.textContent,f.text); assert.equal(space.attributes["aria-hidden"],"true"); assert.equal(ink.attributes["aria-hidden"],"true");
  f.advance(0); f.advance(183); assert.equal(ink.textContent,"e\u0301");
  f.advance(190); assert.equal(f.body.textContent,f.text); assert.equal(f.body.children.length,1); assert.equal(f.frames.size,0);
});
test("Fast writing pauses after punctuation, with longer pauses at sentence boundaries and newlines",()=>{
  for (const [punctuation,pause] of [[",",70],[";",70],["-",70],["–",70],["—",70],[".",180],[":",180],["\n",180],["\r\n",180]]) {
    const f=fixture({text:`a${punctuation}b`}); f.present(f.main);
    const ink=f.body.children[2]; f.advance(0); f.advance(186);
    assert.equal(ink.textContent,`a${punctuation}`);
    f.advance(188+pause); assert.equal(ink.textContent,`a${punctuation}`);
    f.advance(189+pause); assert.equal(f.body.textContent,f.text); assert.equal(f.frames.size,0);
  }
});
test("Long cards finish within two seconds of writing, with their layout reserved",()=>{
  const f=fixture({text:"Una frase, con pausa; otra frase.\n".repeat(120)}); f.present(f.main);
  assert.equal(f.body.children[1].textContent,f.text);
  f.advance(0); f.advance(2180);
  assert.equal(f.body.textContent,f.text); assert.equal(f.frames.size,0);
});
test("Daily cards arrive with complete text and no typing or reveal control",()=>{
  const f=fixture(); f.stage.dataset.readingMode="complete";
  f.stage.querySelector=selector=>({".idea-body":f.body,"#idea-content":f.title})[selector];
  f.present(f.main);
  assert.equal(f.doc.body.classList.contains("is-reading"),true);
  assert.equal(f.stage.classList.contains("is-arriving"),true);
  assert.equal(f.stage.classList.contains("is-writing"),false);
  assert.equal(f.body.textContent,f.text); assert.equal(f.frames.size,0);
  const refreshed=f.scene(); refreshed.stage.dataset.readingMode="complete"; f.main.stage=refreshed.stage; f.present(f.main);
  assert.equal(refreshed.stage.classList.contains("is-arriving"),false);
});
test("Show full text cancels writing immediately and returns focus to the card",()=>{
  const f=fixture(); f.present(f.main); f.advance(0); f.advance(500);
  f.button.dispatchEvent(new Event("click"));
  assert.equal(f.body.textContent,f.text); assert.equal(f.frames.size,0); assert.equal(f.title.focused,true);
  f.advance(5000); assert.equal(f.body.textContent,f.text);
});
test("Reduced motion and hidden pages show complete text, including preference changes during writing",()=>{
  for (const options of [{reduced:true},{hidden:true}]) {
    const f=fixture(options); f.present(f.main); assert.equal(f.frames.size,0); assert.equal(f.body.textContent,f.text);
  }
  for (const kind of ["motion","visibility"]) {
    const f=fixture(); f.present(f.main);
    if (kind === "motion") { f.motion.matches=true; f.motion.dispatchEvent(new Event("change")); }
    else { f.doc.hidden=true; f.doc.dispatchEvent(new Event("visibilitychange")); }
    assert.equal(f.frames.size,0); assert.equal(f.body.textContent,f.text);
  }
});
test("Refreshes preserve complete text without replay; leaving cancels frames and permits a new entry",()=>{
  const f=fixture(); f.present(f.main);
  const refreshed=f.scene(); f.main.stage=refreshed.stage; f.present(f.main);
  assert.equal(f.frames.size,0); assert.equal(refreshed.body.textContent,f.text);
  f.main.stage=null; f.present(f.main); assert.equal(f.doc.body.classList.contains("is-reading"),false);
  const returned=f.scene(); f.main.stage=returned.stage; f.present(f.main); assert.equal(f.frames.size,1);
  const next=f.scene("two","Otra idea."); f.main.stage=next.stage; f.present(f.main);
  assert.equal(f.frames.size,1); assert.equal(returned.body.textContent,f.text);
  f.advance(0); f.advance(5000); assert.equal(next.body.textContent,"Otra idea.");
});
