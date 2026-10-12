import test from "node:test";
import assert from "node:assert/strict";
import {calibrationFields,currentCalibration,normalizeCalibration,restoreCalibration,calibrationConfiguration} from "../brand/reed/growth/position-study/calibration-model.mjs";
import {mascotArt} from "./mascot-art.mjs";

test("Calibration drafts preserve thirteen values and export matching face and body settings",()=>{
  const baseline=currentCalibration("root",{x:0,y:-4.5,scale:.9});
  assert.equal(Object.keys(baseline).length,13);
  assert.equal(new Set(calibrationFields.map(field=>field.key)).size,13);
  const edited=normalizeCalibration({...baseline,bodyY:-6,mouthWidth:3.5,rightEyeX:-9,shadowWidth:48},baseline);
  const record=JSON.parse(JSON.stringify({baseline:JSON.stringify(baseline),values:edited}));
  assert.deepEqual(restoreCalibration(record,baseline),edited);
  const config=calibrationConfiguration("root",edited);
  assert.deepEqual(config.body,{x:0,y:-6,scale:.9});
  assert.equal(config.mouth.width,3.5);
  assert.deepEqual(config.shadow,{width:48});
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
  assert.equal(Object.keys(restored).length,13);
});

test("Adding shadow width preserves twelve-field drafts but rejects changed defaults",()=>{
  const baseline=currentCalibration("seed",{scale:.94},{width:72});
  const {shadowWidth,...legacy}=baseline;
  const record={baseline:JSON.stringify(legacy),values:{...legacy,faceX:88,bodyY:-7}};
  const restored=restoreCalibration(record,baseline);
  assert.equal(restored.faceX,88);
  assert.equal(restored.bodyY,-7);
  assert.equal(restored.shadowWidth,72);
  assert.deepEqual(restoreCalibration(record,{...baseline,faceY:baseline.faceY+1}),{...baseline,faceY:baseline.faceY+1});
  assert.deepEqual(restoreCalibration({baseline:"broken",values:legacy},baseline),baseline);
  assert.equal(normalizeCalibration({...baseline,shadowWidth:Infinity},baseline).shadowWidth,72);
  assert.equal(normalizeCalibration({...baseline,shadowWidth:-1},baseline).shadowWidth,10);
});
