import {mascotArt,mascotAssets} from "/app/mascot-art.mjs?v=root-calibration";
import {playMascotExpression} from "/app/mascot-face.mjs?v=root-calibration";
import {calibrationStages,calibrationFields,currentCalibration,normalizeCalibration,restoreCalibration,calibrationConfiguration} from "./calibration-model.mjs?v=root-calibration";
const storageKey="reedleaves:mascot-calibration:v1";
const names={pot:"Maceta",seed:"Semilla",root:"Raíz",seedling:"Plántula",sprout:"Brote"};
const groups={body:"Personaje",face:"Cara y boca",leftEye:"Ojo izquierdo",rightEye:"Ojo derecho"};
const stages=calibrationStages.filter(stage=>Object.hasOwn(mascotAssets,stage));
const select=document.getElementById("mascot-select"),gallery=document.getElementById("preview-gallery");
const controls=document.getElementById("calibration-controls"),iconMode=document.getElementById("icon-mode");
let storage={drafts:{}},storageAvailable=true;
try {
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved && typeof saved==="object" && saved.drafts && typeof saved.drafts==="object" && !Array.isArray(saved.drafts)) storage=saved;
} catch {storageAvailable=false;}
let stage=stages.includes(storage.selected)?storage.selected:stages.includes("root")?"root":stages[0];
let baseline,values;
select.innerHTML=stages.map(id=>`<option value="${id}">${names[id] || id}</option>`).join("");
select.value=stage;
function readBaseline(id) {
  // Read the production CSS so body defaults never drift into a second table.
  const probe=document.createElement("div");probe.hidden=true;probe.innerHTML=mascotArt(id);
  document.body.append(probe);
  const style=getComputedStyle(probe.firstElementChild);
  const body={x:parseFloat(style.getPropertyValue("--mascot-x")),y:parseFloat(style.getPropertyValue("--mascot-y")),scale:parseFloat(style.getPropertyValue("--mascot-scale"))};
  probe.remove();return currentCalibration(id,body);
}
function save() {
  storage.selected=stage;
  if(JSON.stringify(values)===JSON.stringify(baseline)) delete storage.drafts[stage];
  else storage.drafts[stage]={baseline:JSON.stringify(baseline),values:{...values}};
  try {localStorage.setItem(storageKey,JSON.stringify(storage));storageAvailable=true;} catch {storageAvailable=false;}
}
function options() {
  const configuration=calibrationConfiguration(stage,values);
  return {face:configuration.face,mouth:configuration.mouth,variant:iconMode.checked?"icon":"mascot"};
}
function applyBody(art) {
  art.style.setProperty("--mascot-x",`${values.bodyX}%`);
  art.style.setProperty("--mascot-y",`${values.bodyY}%`);
  art.style.setProperty("--mascot-scale",values.bodyScale);
}
function buildPreview() {
  gallery.innerHTML=[160,100,60,32].map(size=>`<figure><figcaption>${size} px</figcaption>${mascotArt(stage,`preview-${size}`,options())}</figure>`).join("");
  for(const art of gallery.querySelectorAll(".mascot-art")) applyBody(art);
}
function updatePreview(key) {
  for(const art of gallery.querySelectorAll(".mascot-art")) {
    applyBody(art);
    if(!iconMode.checked && !key.startsWith("body")) {
      const template=document.createElement("template");template.innerHTML=mascotArt(stage,"",options());
      art.querySelector(".mascot-face").replaceWith(template.content.querySelector(".mascot-face"));
    }
  }
}
function updateStatus() {
  const dirty=JSON.stringify(values)!==JSON.stringify(baseline);
  const message=!dirty?"Valores actuales":storageAvailable?"Borrador local guardado":"Ajustes en memoria";
  const status=document.getElementById("draft-status");if(status.textContent!==message) status.textContent=message;
  document.getElementById("configuration-text").value=JSON.stringify(calibrationConfiguration(stage,values),null,2);
  document.getElementById("copy-status").textContent="";
}
function buildControls() {
  controls.innerHTML=Object.entries(groups).map(([group,name])=>`<fieldset data-group="${group}"><legend>${name}</legend>${calibrationFields.filter(field=>field.group===group).map(field=>{
    const min=Math.min(field.min,baseline[field.key]),max=Math.max(field.max,baseline[field.key]);
    return `<div class="calibration-control"><label for="range-${field.key}">${field.label}</label><input type="range" id="range-${field.key}" aria-label="${name} · ${field.label}" min="${min}" max="${max}" step="${field.step}" value="${values[field.key]}" data-key="${field.key}"><input type="number" id="value-${field.key}" aria-label="Valor de ${name} · ${field.label}" min="${min}" max="${max}" step="any" value="${values[field.key]}" data-key="${field.key}"></div>`;
  }).join("")}</fieldset>`).join("");
  updateMode();
}
function updateMode() {
  for(const fieldset of controls.querySelectorAll("fieldset")) fieldset.disabled=iconMode.checked && fieldset.dataset.group!=="body";
  document.getElementById("greet-all").disabled=iconMode.checked;
  document.getElementById("wink-all").disabled=iconMode.checked;
}
function choose() {
  stage=select.value;baseline=readBaseline(stage);
  values=restoreCalibration(Object.hasOwn(storage.drafts,stage)?storage.drafts[stage]:null,baseline);
  buildControls();buildPreview();save();updateStatus();
}
select.addEventListener("change",choose);
controls.addEventListener("submit",event=>event.preventDefault());
controls.addEventListener("input",event=>{
  const input=event.target,key=input.dataset.key;if(!key) return;
  const value=input.valueAsNumber;if(!Number.isFinite(value)) return;
  values=normalizeCalibration({...values,[key]:value},baseline);
  for(const peer of controls.querySelectorAll(`[data-key="${key}"]`)) if(peer!==input || values[key]!==value) peer.value=values[key];
  updatePreview(key);save();updateStatus();
});
controls.addEventListener("focusout",event=>{
  const input=event.target,key=input.dataset.key;if(key) input.value=values[key];
});
iconMode.addEventListener("change",()=>{buildPreview();updateMode();});
document.getElementById("show-frames").addEventListener("change",event=>gallery.classList.toggle("show-frames",event.target.checked));
document.getElementById("reset-all").addEventListener("click",()=>{values={...baseline};save();buildControls();buildPreview();updateStatus();});
document.getElementById("greet-all").addEventListener("click",()=>{
  for(const art of gallery.querySelectorAll(".mascot-art")) {art.classList.remove("is-greeting");void art.offsetWidth;art.classList.add("is-greeting");}
});
document.getElementById("wink-all").addEventListener("click",()=>{for(const art of gallery.querySelectorAll(".mascot-art")) playMascotExpression(art,"wink-right");});
document.getElementById("configuration").addEventListener("toggle",event=>document.querySelector(".preview-panel").classList.toggle("configuration-open",event.target.open));
document.getElementById("copy-config").addEventListener("click",async()=>{
  const text=document.getElementById("configuration-text"),status=document.getElementById("copy-status");
  try {await navigator.clipboard.writeText(text.value);status.textContent="Configuración copiada.";}
  catch {document.getElementById("configuration").open=true;text.focus();text.select();status.textContent="Selecciona y copia la configuración.";}
});
choose();
