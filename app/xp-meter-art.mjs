// El progress conserva la semántica y los valores; el listón es decorativo.
export function mountXpMeterArt(doc,{showLevels=true}={}) {
  const View=doc.defaultView;

  function sync(meter,art) {
    const max=Number(meter.getAttribute("max"))||1,value=Number(meter.getAttribute("value"))||0;
    art.style.setProperty("--p",String(Math.min(1,Math.max(0,value/max))));
    if(!showLevels)return;
    const level=Number(meter.dataset.level),hasLevel=Number.isSafeInteger(level)&&meter.dataset.level!=="";
    art.classList.toggle("has-level",hasLevel);
    const current=art.querySelector("[data-level-current]"),next=art.querySelector("[data-level-next]");
    if(current)current.textContent=hasLevel?String(level):"";
    if(next)next.textContent=hasLevel?String(level+1):"";
  }
  function decorate(meter) {
    let art=meter.nextElementSibling?.classList.contains("xp-meter-art")?meter.nextElementSibling:null;
    if(!art){
      art=doc.createElement("span");
      art.className=`${meter.className.replace(/\bxp-meter\b/,"").trim()} xp-meter-art xp-meter-art--liston`.trim();
      art.setAttribute("aria-hidden","true");
      const plank='<span class="xp-liston-plank"><span class="xp-liston-paint"></span><span class="xp-liston-ticks"></span></span>';
      art.innerHTML=showLevels?`<span class="xp-liston-disc" data-level-current></span>${plank}<span class="xp-liston-disc is-next" data-level-next></span>`:plank;
      meter.after(art);
    }
    sync(meter,art);
  }
  function refresh(root=doc) {
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
}
