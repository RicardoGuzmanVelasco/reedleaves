// Prueba local: dibuja la barra de XP como Junco o Listón sobre el <progress> existente.
// El <progress> conserva la semántica y los valores; el arte es decorativo y lo sigue.
export const xpMeterStyles=["classic","junco","liston"];
export const xpMeterStyle=value=>xpMeterStyles.includes(value)?value:"classic";

const leaves=Array.from({length:9},(_,i)=>`<i class="xp-junco-leaf ${i%2?"is-down":"is-up"}" style="--t:${(i+1)/10}"></i>`).join("");
const petals=Array.from({length:5},(_,i)=>`<ellipse cx="18" cy="9" rx="6" ry="7.5" fill="#F4A6A0" stroke="#173D2C" stroke-width="1.6" transform="rotate(${i*72} 18 18)"/>`).join("");
const markup={
  junco:()=>`<span class="xp-junco-track"><span class="xp-junco-ground"></span>${leaves}<span class="xp-junco-stem"></span>
    <span class="xp-junco-tip"><svg viewBox="0 0 26 26" fill="none"><path d="M13 23C13 15 8 8 2 7c0 8 4 15 11 16Z" fill="#58BE59" stroke="#173D2C" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 23c0-8 5-15 11-16 0 8-4 15-11 16Z" fill="#B9E877" stroke="#173D2C" stroke-width="1.8" stroke-linejoin="round"/></svg></span></span>
    <span class="xp-junco-goal"><svg viewBox="0 0 36 36" fill="none">${petals}<circle cx="18" cy="18" r="5" fill="#F2C24B" stroke="#173D2C" stroke-width="1.6"/></svg></span>`,
  liston:()=>`<span class="xp-liston-disc" data-level-current></span><span class="xp-liston-plank"><span class="xp-liston-paint"></span><span class="xp-liston-ticks"></span></span><span class="xp-liston-disc is-next" data-level-next></span>`
};

export function mountXpMeterArt(doc,initialStyle) {
  let style=xpMeterStyle(initialStyle);
  const View=doc.defaultView;

  function sync(meter,art) {
    const max=Number(meter.getAttribute("max"))||1,value=Number(meter.getAttribute("value"))||0;
    art.style.setProperty("--p",String(Math.min(1,Math.max(0,value/max))));
    const level=Number(meter.dataset.level),hasLevel=Number.isSafeInteger(level)&&meter.dataset.level!=="";
    art.classList.toggle("has-level",hasLevel);
    const current=art.querySelector("[data-level-current]"),next=art.querySelector("[data-level-next]");
    if(current)current.textContent=hasLevel?String(level):"";
    if(next)next.textContent=hasLevel?String(level+1):"";
  }
  function decorate(meter) {
    let art=meter.nextElementSibling?.classList.contains("xp-meter-art")?meter.nextElementSibling:null;
    if(style==="classic"){art?.remove();return;}
    if(art?.dataset.style!==style){
      art?.remove();
      art=doc.createElement("span");
      art.className=`${meter.className.replace(/\bxp-meter\b/,"").trim()} xp-meter-art xp-meter-art--${style}`.trim();
      art.dataset.style=style;
      art.setAttribute("aria-hidden","true");
      art.innerHTML=markup[style]();
      meter.after(art);
    }
    sync(meter,art);
  }
  function refresh(root=doc) {
    doc.documentElement.dataset.xpMeterStyle=style;
    if(root.matches?.("progress.xp-meter"))decorate(root);
    root.querySelectorAll?.("progress.xp-meter").forEach(decorate);
  }
  new View.MutationObserver(records=>{
    for(const record of records){
      if(record.type==="attributes"){if(record.target.matches?.("progress.xp-meter"))decorate(record.target);}
      else record.addedNodes.forEach(node=>{if(node.nodeType===1&&!node.classList.contains("xp-meter-art"))refresh(node);});
    }
  }).observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:["value","max","data-level"]});
  refresh();
  return {setStyle(value){style=xpMeterStyle(value);refresh();}};
}
