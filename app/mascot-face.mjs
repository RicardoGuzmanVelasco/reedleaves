// Coordinates belong to the character's 160 × 160 frame, before its body motion.
// One uniform transform preserves the canonical eye spacing and mouth proportions.
export const mascotFacePlacement = Object.freeze(Object.fromEntries(Object.entries({
  pot: {x:81,y:70,rotation:0,scale:1.1},
  seed: {x:82,y:82,rotation:8.5,scale:.9,eyeOffsets:{left:{x:2.5,y:0},right:{x:-1,y:0}}},
  root: {x:94,y:65.5,rotation:16.5,scale:.82,eyeOffsets:{left:{x:10.5,y:-2},right:{x:-10.5,y:-4.5}}},
  seedling: {x:80,y:101,rotation:0,scale:1},
  sprout: {x:79,y:104,rotation:0,scale:1},
  stem: {x:81,y:54,rotation:.5,scale:.74,eyeOffsets:{left:{x:-5,y:-4},right:{x:0,y:-7}}},
  flower: {x:80,y:82.5,rotation:0,scale:.7,eyeOffsets:{left:{x:8,y:0},right:{x:-8,y:0}}}
}).map(([stage,placement]) => [stage,Object.freeze({...placement,
  ...(placement.eyeOffsets ? {eyeOffsets:Object.freeze(Object.fromEntries(Object.entries(placement.eyeOffsets).map(([side,offset])=>[side,Object.freeze(offset)])))} : {})
})])));

const numberOr = (value,fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
// Eye offsets use local face coordinates, before the shared face rotation/scale.
export function mascotFaceGeometry(stage, override) {
  if (!Object.hasOwn(mascotFacePlacement,stage)) return null;
  const base=mascotFacePlacement[stage];
  const eyeOffsets=Object.fromEntries(["left","right"].map(side=>{
    const defaults=base.eyeOffsets?.[side];
    const offset=override?.eyeOffsets?.[side];
    return [side,{x:numberOr(offset?.x,defaults?.x ?? 0),y:numberOr(offset?.y,defaults?.y ?? 0)}];
  }));
  return {x:numberOr(override?.x,base.x),y:numberOr(override?.y,base.y),
    rotation:numberOr(override?.rotation,base.rotation),
    scale:typeof override?.scale === "number" && Number.isFinite(override.scale) && override.scale>0 ? override.scale : base.scale,
    eyeOffsets};
}

// Width is a multiplier of the canonical 8-unit mouth. An absent override inherits.
// Approved widths: common 4.5×, with a few character-specific exceptions.
export const mascotMouthConfig = Object.freeze({width:4.5,overrides:Object.freeze({pot:5.5,root:3.75,sprout:2,seedling:5,stem:3.75,flower:2.5})});
const validMouthWidth = width => typeof width === "number" && Number.isFinite(width) && width > 0 && width <= 6;
export function mascotMouthWidth(stage, config = mascotMouthConfig) {
  const general = validMouthWidth(config?.width) ? config.width : mascotMouthConfig.width;
  const specific = config?.overrides && Object.hasOwn(config.overrides,stage) ? config.overrides[stage] : undefined;
  return validMouthWidth(specific) ? specific : general;
}
export function mascotMouthPath(stage, config = mascotMouthConfig) {
  const width = 8 * mascotMouthWidth(stage,config);
  // Recompute the curve: center, depth and stroke remain independent of width.
  return `M${82-width/2} 119q${width/2} 6 ${width} 0`;
}

const expressions = new Set(["neutral","wink-left","wink-right","blink"]);

// Lossless face crops from reserved A. Together with pot-a-body.png these
// restore the source artwork, while retaining separate eye-expression layers.
const potSourceFrame = 340;
const potSourcePose = {x:81,y:70,scale:1.1};
const potFacePatches = Object.freeze({
  left: {file:"left-eye",rect:[92,151,24,30],center:[103.5,166]},
  right: {file:"right-eye",rect:[227,151,24,30],center:[239.5,166]},
  mouth: {file:"mouth",rect:[122,192,98,22]}
});
const sourceFacePoint = (value,axis) => (value*160/potSourceFrame-potSourcePose[axis])/potSourcePose.scale+({x:82,y:104}[axis]);
const sourceFaceImage = (patch,origin={x:0,y:0}) => {
  const [x,y,width,height]=patch.rect;
  return `<image href="/brand/reed/growth/bodies/pot-a-${patch.file}.png" x="${sourceFacePoint(x,"x")-origin.x}" y="${sourceFacePoint(y,"y")-origin.y}" width="${width*160/potSourceFrame/potSourcePose.scale}" height="${height*160/potSourceFrame/potSourcePose.scale}"/>`;
};
function potSourceFace(eyeOffsets,mouth) {
  const eyes=["left","right"].map(side=>{
    const patch=potFacePatches[side];
    const origin={x:sourceFacePoint(patch.center[0],"x"),y:sourceFacePoint(patch.center[1],"y")};
    const offset=eyeOffsets[side];
    return `<g class="mascot-eye mascot-eye--${side}" transform="translate(${origin.x+offset.x} ${origin.y+offset.y})"><g class="mascot-eye-expression">${sourceFaceImage(patch,origin)}</g></g>`;
  }).join("");
  const originalMouth=mascotMouthWidth("pot",mouth)===5.5;
  const smile=originalMouth ? sourceFaceImage(potFacePatches.mouth) : `<path d="${mascotMouthPath("pot",mouth)}" stroke="#173D2C" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  return `${eyes}<g class="mascot-mouth">${smile}</g>`;
}
export function mascotFace(stage, expression = "neutral", mouth = mascotMouthConfig, face) {
  const placement = mascotFaceGeometry(stage,face);
  if (!placement) return "";
  const {x,y,rotation,scale,eyeOffsets} = placement;
  const state = expressions.has(expression) ? expression : "neutral";
  if (stage==="pot") return `<svg class="mascot-face" viewBox="0 0 160 160" aria-hidden="true" focusable="false" data-expression="${state}"><g class="mascot-face-placement" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-82 -104)">${potSourceFace(eyeOffsets,mouth)}</g></svg>`;
  return `<svg class="mascot-face" viewBox="0 0 160 160" aria-hidden="true" focusable="false" data-expression="${state}"><g class="mascot-face-placement" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-82 -104)" fill="#173D2C"><g class="mascot-eye mascot-eye--left" transform="translate(${53+eyeOffsets.left.x} ${104+eyeOffsets.left.y})"><g class="mascot-eye-expression"><ellipse cx="0" cy="0" rx="3.5" ry="5"/></g></g><g class="mascot-eye mascot-eye--right" transform="translate(${111+eyeOffsets.right.x} ${104+eyeOffsets.right.y})"><g class="mascot-eye-expression"><ellipse cx="0" cy="0" rx="3.5" ry="5"/></g></g><g class="mascot-mouth"><path d="${mascotMouthPath(stage,mouth)}" stroke="#173D2C" stroke-width="3" stroke-linecap="round" fill="none"/></g></g></svg>`;
}


const expressionMotion = Object.freeze({
  "wink-left":"is-winking-left", "wink-right":"is-winking-right", blink:"is-blinking"
});
// Restart the eye gesture without cancelling the body's idle loop.
export function playMascotExpression(art, expression = "wink-right") {
  if (!Object.hasOwn(expressionMotion,expression) || !art?.querySelector(".mascot-face")) return false;
  art.classList.remove("is-auto-blinking",...Object.values(expressionMotion));
  void art.offsetWidth;
  art.classList.add(expressionMotion[expression]);
  return true;
}
