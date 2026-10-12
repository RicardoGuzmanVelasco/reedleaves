import test from "node:test";
import assert from "node:assert/strict";
import {calibrationFields,currentCalibration,normalizeCalibration,restoreCalibration,calibrationConfiguration} from "../brand/reed/growth/position-study/calibration-model.mjs";
import {mascotArt} from "./mascot-art.mjs";

test("Calibration drafts preserve twelve values and export matching face and body settings",()=>{
  const baseline=currentCalibration("root",{x:0,y:-4.5,scale:.9});
  assert.equal(Object.keys(baseline).length,12);
  assert.equal(new Set(calibrationFields.map(field=>field.key)).size,12);
  const edited=normalizeCalibration({...baseline,bodyY:-6,mouthWidth:3.5,rightEyeX:-9},baseline);
  const record=JSON.parse(JSON.stringify({baseline:JSON.stringify(baseline),values:edited}));
  assert.deepEqual(restoreCalibration(record,baseline),edited);
  const config=calibrationConfiguration("root",edited);
  assert.deepEqual(config.body,{x:0,y:-6,scale:.9});
  assert.equal(config.mouth.width,3.5);
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
  assert.equal(Object.keys(restored).length,12);
});
