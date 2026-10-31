import test from "node:test";
import assert from "node:assert/strict";
import {createReadingArrival} from "./reading-arrival.mjs";

class Element extends EventTarget {
  constructor(text = "") {
    super(); this.textContent = text;
    const classes = new Set();
    this.classList = {
      add:(...items)=>items.forEach(item=>classes.add(item)),
      contains:item=>classes.has(item),
      toggle:(item,on)=>on ? classes.add(item) : classes.delete(item)
    };
  }
}

function fixture() {
  const doc = new EventTarget(); doc.body = new Element();
  const present = createReadingArrival({document:doc});
  function scene(cardId = "one", text = "Una idea para recordar.") {
    const body = new Element(text), title = new Element("Idea");
    body.lang = "es";
    const stage = new Element(); stage.dataset = {readingCard:cardId};
    stage.querySelector = selector=>({".idea-body":body,"#idea-content":title})[selector];
    stage.closest = ()=>null;
    return {stage,body,title};
  }
  const first = scene();
  const main = {querySelector:()=>main.stage,stage:first.stage};
  return {doc,present,main,...first,scene};
}

test("Reading keeps full card text and animates only the fresh card entrance",()=>{
  const f=fixture();
  f.present(f.main);
  assert.equal(f.doc.body.classList.contains("is-reading"),true);
  assert.equal(f.stage.classList.contains("is-arriving"),true);
  assert.equal(f.body.textContent,"Una idea para recordar.");

  const refreshed=f.scene();
  f.main.stage=refreshed.stage;
  f.present(f.main);
  assert.equal(refreshed.stage.classList.contains("is-arriving"),false);
  assert.equal(refreshed.body.textContent,"Una idea para recordar.");
});

test("Choreographed flips skip a second entrance and leaving clears the reading backdrop",()=>{
  const f=fixture();
  f.present(f.main,{arrival:false});
  assert.equal(f.stage.classList.contains("is-arriving"),false);

  f.main.stage=null;
  f.present(f.main);
  assert.equal(f.doc.body.classList.contains("is-reading"),false);
});

test("Returning to a card gets a new entrance",()=>{
  const f=fixture();
  f.present(f.main);
  f.main.stage=null;
  f.present(f.main);
  const returned=f.scene();
  f.main.stage=returned.stage;
  f.present(f.main);
  assert.equal(returned.stage.classList.contains("is-arriving"),true);
});
