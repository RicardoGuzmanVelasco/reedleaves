import {loadCatalog} from "/app/catalog.mjs";
import {homeView,libraryView,libraryResultsMarkup} from "/app/views.mjs";

// This study only reads the catalog. Enrollment and growth are local samples.
const preview=document.querySelector("#cover-preview"),dialogHost=document.querySelector("#study-dialog-host");
const descriptions={
  current:"Tapa verde de base, título arriba a la izquierda y autor debajo. Mascota como sello al pie.",
  cloth:"Tapa entelada sin marco, lomo oscuro y título en serif. Mascota como sello al pie."
};
const parameters=[
  {id:"cover-height",property:"--cover-height",defaultValue:270,unit:"px"},
  {id:"author-size",property:"--cover-author-size",defaultValue:13,unit:"px"},
  {id:"stamp-size",property:"--cover-stamp-size",defaultValue:100,unit:"px"},
  {id:"stamp-bottom",property:"--cover-stamp-bottom",defaultValue:6,unit:"px"},
  {id:"stamp-opacity",property:"--cover-stamp-opacity",defaultValue:68,unit:"%"}
];
function updateParameters() {
  for (const parameter of parameters) {
    const value=Number(document.getElementById(parameter.id).value);
    preview.style.setProperty(parameter.property,parameter.unit === "%" ? String(value/100) : `${value}px`);
    document.getElementById(`${parameter.id}-value`).value=`${value} ${parameter.unit}`;
  }
}
document.querySelectorAll(".study-sliders input").forEach(input=>input.addEventListener("input",updateParameters));
document.querySelector("#study-reset").addEventListener("click",()=>{
  for (const parameter of parameters) document.getElementById(parameter.id).value=parameter.defaultValue;
  updateParameters();
});
updateParameters();
let catalog,state,design="current";
function render() {
  if (!catalog) return;
  const language=document.querySelector("#study-language").value;
  state={catalog,language,showOriginalTitles:document.querySelector("#study-original").checked,
    statuses:{},reviews:{},enrolledIds:[...catalog.selectedVersions.values()],
    growth:Object.fromEntries(catalog.books.map((book,index)=>[book.id,{added:true,spentDays:[0,1,2,3,5][index%5]}]))};
  const template=document.createElement("template");
  template.innerHTML=document.querySelector("#study-surface").value === "home" ? homeView(state) : libraryResultsMarkup(state);
  const grid=template.content.querySelector(".study-books");
  if (!grid) {preview.replaceChildren(template.content);return;}
  for (const book of grid.querySelectorAll(".study-book")) {
    const sample=document.createElement("div");sample.className="cover-sample";
    book.before(sample);sample.append(book);
  }
  preview.dataset.design=design;
  preview.replaceChildren(grid);
  document.querySelector("#study-description").textContent=descriptions[design];
}
document.querySelectorAll("[data-design]").forEach(button=>{
  if (button.tagName !== "BUTTON") return;
  button.addEventListener("click",()=>{
    design=button.dataset.design;
    document.querySelectorAll("button[data-design]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    render();
  });
});
document.querySelectorAll(".study-options input,.study-options select").forEach(control=>control.addEventListener("change",render));
preview.addEventListener("click",event=>{
  const button=event.target.closest(".study-book");
  if (!button) return;
  const template=document.createElement("template");
  template.innerHTML=libraryView({...state,openBookId:button.dataset.book,readOnly:true});
  const dialog=template.content.querySelector(".book-modal");
  dialog.id="study-book-dialog";
  // The study reads actual metadata without inventing the account's status.
  dialog.querySelector(".book-detail-status")?.remove();
  const libraryLink=dialog.querySelector('a[href^="#library/book/"]');
  if (libraryLink) libraryLink.setAttribute("href",`/app/${libraryLink.getAttribute("href")}`);
  dialog.querySelector(".deck-modal-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>button.focus(),{once:true});
  dialogHost.replaceChildren(dialog);
  dialog.showModal();
});
try {catalog=await loadCatalog();render();}
catch {preview.textContent="No se ha podido cargar el catálogo. Abre la app e inicia sesión; después recarga esta propuesta.";}
