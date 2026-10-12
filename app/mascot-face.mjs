// Coordinates belong to the character's 160 × 160 frame, before its body motion.
// One uniform transform preserves the canonical eye spacing and mouth proportions.
export const mascotFacePlacement = Object.freeze(Object.fromEntries(Object.entries({
  pot: {x:80,y:83,rotation:0,scale:1},
  seed: {x:82,y:81,rotation:0,scale:1},
  root: {x:95,y:66,rotation:12,scale:.8},
  seedling: {x:80,y:101,rotation:0,scale:1},
  sprout: {x:82,y:104,rotation:0,scale:1}
}).map(([stage,placement]) => [stage,Object.freeze(placement)])));

// Width is a multiplier of the canonical 8-unit mouth. An absent override inherits.
// Current product widths stay at 1× until an art proposal is chosen.
export const mascotMouthConfig = Object.freeze({width:1,overrides:Object.freeze({})});
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
export function mascotFace(stage, expression = "neutral", mouth = mascotMouthConfig) {
  const placement = Object.hasOwn(mascotFacePlacement,stage) ? mascotFacePlacement[stage] : null;
  if (!placement) return "";
  const {x,y,rotation,scale} = placement;
  const state = expressions.has(expression) ? expression : "neutral";
  return `<svg class="mascot-face" viewBox="0 0 160 160" aria-hidden="true" focusable="false" data-expression="${state}"><g class="mascot-face-placement" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-82 -104)" fill="#173D2C"><g class="mascot-eye mascot-eye--left" transform="translate(53 104)"><g class="mascot-eye-expression"><ellipse cx="0" cy="0" rx="3.5" ry="5"/></g></g><g class="mascot-eye mascot-eye--right" transform="translate(111 104)"><g class="mascot-eye-expression"><ellipse cx="0" cy="0" rx="3.5" ry="5"/></g></g><g class="mascot-mouth"><path d="${mascotMouthPath(stage,mouth)}" stroke="#173D2C" stroke-width="3" stroke-linecap="round" fill="none"/></g></g></svg>`;
}


const expressionMotion = Object.freeze({
  "wink-left":"is-winking-left", "wink-right":"is-winking-right", blink:"is-blinking"
});
// Restart the eye gesture without cancelling a simultaneous body greeting.
export function playMascotExpression(art, expression = "wink-right") {
  if (!Object.hasOwn(expressionMotion,expression) || !art?.querySelector(".mascot-face")) return false;
  art.classList.remove(...Object.values(expressionMotion));
  void art.offsetWidth;
  art.classList.add(expressionMotion[expression]);
  return true;
}
