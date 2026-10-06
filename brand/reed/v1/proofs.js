"use strict";

const proofs = {
  a:{title:"Abrazo",file:"a-abrazo",x:67.2,y:58,scale:.76},
  b:{title:"Papel",file:"b-papel",x:67.2,y:58,scale:.76},
  c:{title:"Trazo",file:"c-trazo",x:60.8,y:52,scale:.84},
  d:{title:"Compacto",file:"d-compacto",x:60.8,y:52,scale:.84}
};

function drawFace(element,key){
  const {x,y,scale} = proofs[key];
  element.querySelector(".face")?.remove();
  element.insertAdjacentHTML("beforeend",`<svg class="face" viewBox="0 0 256 256" aria-hidden="true"><g transform="translate(${x} ${y}) scale(${scale})" fill="#173D2C"><ellipse cx="53" cy="104" rx="3.5" ry="5"/><ellipse cx="111" cy="104" rx="3.5" ry="5"/><path d="M78 119q4 6 8 0" stroke="#173D2C" stroke-width="3" stroke-linecap="round" fill="none"/></g></svg>`);
}

function choose(key){
  const proof = proofs[key];
  document.querySelectorAll(".pick").forEach(button=>{
    const selected = button.dataset.key===key;
    button.setAttribute("aria-pressed",String(selected));
    button.closest(".variant").classList.toggle("selected",selected);
  });
  const title = `${key.toUpperCase()} · ${proof.title}`;
  document.getElementById("application-title").textContent=title;
  document.getElementById("choice-note").textContent=`${title}: vista previa, pendiente de elección.`;
  const symbol=document.getElementById("chosen-symbol");
  symbol.dataset.key=key;
  symbol.querySelector("img").src=`${proof.file}.svg`;
  symbol.querySelector("img").alt=`Reed: prueba ${title}`;
  drawFace(symbol,key);
  document.getElementById("size24").src=`${proof.file}-mono.svg`;
  document.getElementById("size48").src=`${proof.file}.svg`;
  document.getElementById("size96").src=`${proof.file}.svg`;
  document.getElementById("mono").src=`${proof.file}-mono.svg`;
  document.getElementById("export-color").href=`${proof.file}.svg`;
  document.getElementById("export-mascot").href=`${proof.file}-mascot.svg`;
  document.getElementById("export-mono").href=`${proof.file}-mono.svg`;
}

document.querySelectorAll(".symbol").forEach(element=>drawFace(element,element.dataset.key));
document.querySelectorAll(".pick").forEach(button=>button.addEventListener("click",()=>choose(button.dataset.key)));
for(const [id,className] of [["face-switch","show-face"],["axis-switch","show-axis"]]){
  document.getElementById(id).addEventListener("click",event=>{
    const active=event.currentTarget.getAttribute("aria-pressed")!=="true";
    event.currentTarget.setAttribute("aria-pressed",String(active));
    document.body.classList.toggle(className,active);
  });
}
