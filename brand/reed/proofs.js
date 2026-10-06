"use strict";

const proofs = {
  a:{title:"Abrazo",file:"a-abrazo"},
  b:{title:"Papel",file:"b-papel"},
  c:{title:"Trazo",file:"c-trazo"},
  d:{title:"Compacto",file:"d-compacto"}
};


function choose(key){
  const proof = proofs[key];
  document.querySelectorAll(".pick").forEach(button=>{
    const selected = button.dataset.key===key;
    button.setAttribute("aria-pressed",String(selected));
    button.closest(".variant").classList.toggle("selected",selected);
  });
  const title = `${key.toUpperCase()} · ${proof.title}`;
  document.getElementById("application-title").textContent=title;
  document.getElementById("choice-note").textContent=key === "d" ? "Compacto · B Salvia. Hojas originales; sombra exterior del libro oscura." : `${title}: exploración anterior; la forma elegida es Compacto.`;
  const symbol=document.getElementById("chosen-symbol");
  symbol.dataset.key=key;
  symbol.querySelector("img").src=`${proof.file}.svg`;
  symbol.querySelector("img").alt=`Reed: prueba ${title}`;
  document.getElementById("size24").src=`${proof.file}-mono.svg`;
  document.getElementById("size48").src=`${proof.file}.svg`;
  document.getElementById("size96").src=`${proof.file}.svg`;
  document.getElementById("mono").src=`${proof.file}-mono.svg`;
  document.getElementById("export-color").href=`${proof.file}.svg`;
  document.getElementById("export-mono").href=`${proof.file}-mono.svg`;
}

document.querySelectorAll(".pick").forEach(button=>button.addEventListener("click",()=>choose(button.dataset.key)));
choose("d");
for(const [id,className] of [["axis-switch","show-axis"]]){
  document.getElementById(id).addEventListener("click",event=>{
    const active=event.currentTarget.getAttribute("aria-pressed")!=="true";
    event.currentTarget.setAttribute("aria-pressed",String(active));
    document.body.classList.toggle(className,active);
  });
}
