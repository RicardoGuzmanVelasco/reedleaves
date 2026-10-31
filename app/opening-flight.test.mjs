import test from "node:test";
import assert from "node:assert/strict";
import {waitForOpeningFlight} from "./opening-flight.mjs";

test("A fast load waits for the existing flight; a finished flight does not delay a slow load", async () => {
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const root = {querySelector: () => ({getAnimations: () => [{animationName:"opening-sprout-flight",finished}]})};
  const flight = waitForOpeningFlight(root);
  let ready = false;
  const opening = flight.then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  finish();
  await opening;
  assert.equal(ready, true);
  await waitForOpeningFlight(root);
});

test("Reduced motion, missing artwork and cancelled animation never block startup", async () => {
  const root = {querySelector: () => ({getAnimations: () => [{animationName:"opening-sprout-flight",finished:new Promise(() => {})}]})};
  await waitForOpeningFlight(root, true);
  await waitForOpeningFlight({querySelector: () => null});
  await waitForOpeningFlight({querySelector: () => ({getAnimations: () => [{animationName:"opening-sprout-flight",finished:Promise.reject(new Error("cancelled"))}]})});
});
