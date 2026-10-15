import test from "node:test";
import assert from "node:assert/strict";
import {calibrationStages,calibrationFields,currentCalibration,normalizeCalibration,restoreCalibration,calibrationConfiguration} from "../brand/reed/growth/position-study/calibration-model.mjs";
import {mascotArt} from "./mascot-art.mjs";

test("Tallo exports all fourteen controls and renders its adjusted face independently",()=>{
  assert.ok(calibrationStages.includes("stem"));
  const baseline=currentCalibration("stem");
  assert.equal(Object.keys(baseline).length,14);
  const edited=normalizeCalibration({...baseline,faceX:75,leftEyeX:2,rightEyeY:-1,mouthWidth:3},baseline);
  const config=calibrationConfiguration("stem",edited);
  const html=mascotArt("stem","",{face:config.face,mouth:config.mouth});
  assert.match(html,/growth\/bodies\/stem\.png/);
  assert.match(html,/translate\(75 115.5\)/);
  assert.match(html,/mascot-eye--left" transform="translate\(55 104\)"/);
  assert.match(html,/mascot-eye--right" transform="translate\(111 103\)"/);
  assert.match(html,/d="M70 119q12 6 24 0"/);
  assert.deepEqual(restoreCalibration({baseline:JSON.stringify(baseline),values:edited},baseline),edited);
});

test("Calibration drafts preserve fourteen values and export matching face and body settings",()=>{
  const baseline=currentCalibration("root",{x:0,y:-4.5,scale:.9});
  assert.equal(Object.keys(baseline).length,14);
  assert.equal(new Set(calibrationFields.map(field=>field.key)).size,14);
  const edited=normalizeCalibration({...baseline,bodyY:-6,mouthWidth:3.5,rightEyeX:-9,shadowWidth:48,shadowHeight:7},baseline);
  const record=JSON.parse(JSON.stringify({baseline:JSON.stringify(baseline),values:edited}));
  assert.deepEqual(restoreCalibration(record,baseline),edited);
  const config=calibrationConfiguration("root",edited);
  assert.deepEqual(config.body,{x:0,y:-6,scale:.9});
  assert.equal(config.mouth.width,3.5);
  assert.deepEqual(config.shadow,{width:48,height:7});
  assert.equal(config.face.eyeOffsets.right.x,-9);
  const html=mascotArt(config.stage,"",{face:config.face,mouth:config.mouth});
  assert.match(html,/mascot-eye--right" transform="translate\(102 99.5\)"/);
  assert.match(html,/d="M68 119q14 6 28 0"/);
});

test("Old or invalid local drafts cannot override updated product calibration",()=>{
  const baseline=currentCalibration("seed",{scale:.94});
  const draft={...baseline,faceY:75};
  const oldRecord={baseline:JSON.stringify({...baseline,faceY:81}),values:draft};
  assert.deepEqual(restoreCalibration(oldRecord,baseline),baseline);
  const invalid={...baseline,bodyX:"40",faceY:NaN,mouthWidth:Infinity,faceScale:-1,unexpected:12};
  const restored=normalizeCalibration(invalid,baseline);
  assert.equal(restored.bodyX,baseline.bodyX);
  assert.equal(restored.faceY,baseline.faceY);
  assert.equal(restored.mouthWidth,baseline.mouthWidth);
  assert.ok(restored.faceScale>0);
  assert.equal(Object.keys(restored).length,14);
});

test("Adding shadow height preserves thirteen-field drafts and existing shadow width edits",()=>{
  const baseline=currentCalibration("stem",{y:-5,scale:.92},{width:34});
  const {shadowHeight,...legacy}=baseline;
  const record={baseline:JSON.stringify(legacy),values:{...legacy,faceX:77,shadowWidth:42}};
  const restored=restoreCalibration(record,baseline);
  assert.deepEqual(restored,{...baseline,faceX:77,shadowWidth:42});
  assert.equal(restored.shadowHeight,15.384615);
  for(const key of Object.keys(legacy)) {
    const changed={...baseline,[key]:baseline[key]+1};
    assert.deepEqual(restoreCalibration(record,changed),changed,`Changed ${key} default must invalidate old draft`);
  }
});

test("Adding shadow controls preserves twelve-field drafts but rejects changed defaults",()=>{
  const baseline=currentCalibration("seed",{scale:.94},{width:72});
  const {shadowWidth,shadowHeight,...legacy}=baseline;
  const record={baseline:JSON.stringify(legacy),values:{...legacy,faceX:88,bodyY:-7}};
  const restored=restoreCalibration(record,baseline);
  assert.equal(restored.faceX,88);
  assert.equal(restored.bodyY,-7);
  assert.equal(restored.shadowWidth,72);
  assert.equal(restored.shadowHeight,15.384615);
  assert.deepEqual(restoreCalibration(record,{...baseline,faceY:baseline.faceY+1}),{...baseline,faceY:baseline.faceY+1});
  assert.deepEqual(restoreCalibration({baseline:"broken",values:legacy},baseline),baseline);
  assert.equal(normalizeCalibration({...baseline,shadowWidth:Infinity},baseline).shadowWidth,72);
  assert.equal(normalizeCalibration({...baseline,shadowWidth:-1},baseline).shadowWidth,10);
});

test("Shadow height inherits production values, is bounded and remains independent of width",()=>{
  for(const stage of calibrationStages) assert.equal(currentCalibration(stage).shadowHeight,15.384615);
  const baseline=currentCalibration("root",{},{width:72,height:9});
  assert.equal(baseline.shadowHeight,9);
  assert.deepEqual(calibrationConfiguration("root",normalizeCalibration({...baseline,shadowHeight:4},baseline)).shadow,{width:72,height:4});
  for(const invalid of [NaN,Infinity,"7",null]) assert.equal(normalizeCalibration({...baseline,shadowHeight:invalid},baseline).shadowHeight,9);
  assert.equal(normalizeCalibration({...baseline,shadowHeight:-2},baseline).shadowHeight,1);
  assert.equal(normalizeCalibration({...baseline,shadowHeight:80},baseline).shadowHeight,50);
  const draft={baseline:JSON.stringify(baseline),values:{...baseline,shadowHeight:4}};
  const changed={...baseline,shadowHeight:10};
  assert.deepEqual(restoreCalibration(draft,changed),changed);
});
