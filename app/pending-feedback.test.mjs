import test from "node:test";
import assert from "node:assert/strict";
import {createPendingFeedback} from "./pending-feedback.mjs";

function fakeTimers() {
  let next=1;const timers=new Map();
  return {
    schedule:(callback,delay)=>{const id=next++;timers.set(id,{callback,delay});return id;},
    cancel:id=>timers.delete(id),
    fire:()=>{for(const [id,timer] of [...timers]){timers.delete(id);timer.callback();}},
    get count() {return timers.size;}
  };
}

test("a quick wait that ends within the grace period never shows the feedback",()=>{
  const timers=fakeTimers(),shown=[];
  const feedback=createPendingFeedback({delay:300,onChange:visible=>shown.push(visible),...timers});
  feedback.start();
  assert.equal(feedback.pending,true);assert.equal(feedback.visible,false);
  assert.equal(feedback.end(),false);
  timers.fire();
  assert.deepEqual(shown,[]);assert.equal(feedback.visible,false);
});

test("a quick wait that lasts longer than the grace period shows it",()=>{
  const timers=fakeTimers(),shown=[];
  const feedback=createPendingFeedback({delay:300,onChange:visible=>shown.push(visible),...timers});
  feedback.start();
  timers.fire();
  assert.deepEqual(shown,[true]);assert.equal(feedback.visible,true);
  assert.equal(feedback.end(),true);assert.equal(feedback.pending,false);assert.equal(feedback.visible,false);
});

test("a wait expected to be slow shows it at once",()=>{
  const timers=fakeTimers(),shown=[];
  const feedback=createPendingFeedback({onChange:visible=>shown.push(visible),...timers});
  feedback.start({slow:true});
  assert.deepEqual(shown,[true]);assert.equal(timers.count,0);
});

test("a new wait replaces the previous one without leaving timers behind",()=>{
  const timers=fakeTimers(),shown=[];
  const feedback=createPendingFeedback({onChange:visible=>shown.push(visible),...timers});
  feedback.start();feedback.start();
  assert.equal(timers.count,1);
  feedback.end();
  assert.equal(timers.count,0);
});
