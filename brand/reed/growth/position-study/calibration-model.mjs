import {mascotFaceGeometry,mascotMouthWidth,mascotFacePlacement} from "../../../../app/mascot-face.mjs?v=sprout-calibration";
export const calibrationStages = Object.keys(mascotFacePlacement);
export const calibrationFields = Object.freeze([
  {key:"bodyX",group:"body",label:"Horizontal (%)",min:-50,max:50,step:.5},
  {key:"bodyY",group:"body",label:"Vertical (%)",min:-50,max:50,step:.5},
  {key:"bodyScale",group:"body",label:"Escala (×)",min:.2,max:2,step:.01},
  {key:"shadowWidth",group:"shadow",label:"Anchura (%)",min:10,max:100,step:.5},
  {key:"mouthWidth",group:"face",label:"Anchura de boca (×)",min:.25,max:6,step:.125},
  {key:"faceX",group:"face",label:"Horizontal",min:0,max:160,step:.5},
  {key:"faceY",group:"face",label:"Vertical",min:0,max:160,step:.5},
  {key:"faceRotation",group:"face",label:"Giro (°)",min:-90,max:90,step:.5},
  {key:"faceScale",group:"face",label:"Escala (×)",min:.2,max:2,step:.01},
  {key:"leftEyeX",group:"leftEye",label:"Horizontal",min:-30,max:30,step:.5},
  {key:"leftEyeY",group:"leftEye",label:"Vertical",min:-30,max:30,step:.5},
  {key:"rightEyeX",group:"rightEye",label:"Horizontal",min:-30,max:30,step:.5},
  {key:"rightEyeY",group:"rightEye",label:"Vertical",min:-30,max:30,step:.5}
]);
const finite = (value,fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
export function currentCalibration(stage,body={},shadow={}) {
  const face=mascotFaceGeometry(stage);
  if(!face) return null;
  return {bodyX:finite(body.x,0),bodyY:finite(body.y,0),bodyScale:finite(body.scale,1),
    shadowWidth:finite(shadow.width,72),mouthWidth:mascotMouthWidth(stage),faceX:face.x,faceY:face.y,faceRotation:face.rotation,faceScale:face.scale,
    leftEyeX:face.eyeOffsets.left.x,leftEyeY:face.eyeOffsets.left.y,
    rightEyeX:face.eyeOffsets.right.x,rightEyeY:face.eyeOffsets.right.y};
}
export function normalizeCalibration(input,baseline) {
  return Object.fromEntries(calibrationFields.map(field=>{
    const min=Math.min(field.min,baseline[field.key]),max=Math.max(field.max,baseline[field.key]);
    return [field.key,Math.max(min,Math.min(max,finite(input?.[field.key],baseline[field.key])))];
  }));
}
export function restoreCalibration(record,baseline) {
  // Upgrade twelve-field drafts without losing edits. Still discard drafts if
  // any existing product default changed.
  if(record?.baseline===JSON.stringify(baseline)) return normalizeCalibration(record.values,baseline);
  try {
    const previous=JSON.parse(record?.baseline);
    const {shadowWidth,...legacyBaseline}=baseline;
    if(previous && !Object.hasOwn(previous,"shadowWidth") && JSON.stringify(previous)===JSON.stringify(legacyBaseline)) {
      return normalizeCalibration({...record.values,shadowWidth},baseline);
    }
  } catch {}
  return {...baseline};
}
export function calibrationConfiguration(stage,values) {
  return {stage,body:{x:values.bodyX,y:values.bodyY,scale:values.bodyScale},shadow:{width:values.shadowWidth},mouth:{width:values.mouthWidth},
    face:{x:values.faceX,y:values.faceY,rotation:values.faceRotation,scale:values.faceScale,
      eyeOffsets:{left:{x:values.leftEyeX,y:values.leftEyeY},right:{x:values.rightEyeX,y:values.rightEyeY}}}};
}
