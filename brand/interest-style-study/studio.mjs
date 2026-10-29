const copy={
  es:{title:"Intereses · Propuesta local",language:"Idioma",width:"Ancho",state:"Estado",mixed:"Tres seleccionados",empty:"Sin seleccionar",second:"Segundo paso",view:"Vista",compare:"Comparar",proposal:"Propuesta",reset:"Reiniciar",baseline:"Actual",baselineFrame:"Selector actual",proposalFrame:"Propuesta de selector"},
  en:{title:"Interests · Local proposal",language:"Language",width:"Width",state:"State",mixed:"Three selected",empty:"None selected",second:"Second step",view:"View",compare:"Compare",proposal:"Proposal",reset:"Reset",baseline:"Current",baselineFrame:"Current selector",proposalFrame:"Proposed selector"}
};
const form=document.querySelector("#study-controls"),params=new URLSearchParams(location.search);
for(const name of ["language","width","state","view"]){const select=form.elements.namedItem(name),value=params.get(name);if([...select.options].some(option=>option.value===value))select.value=value;}
function render(){
  const language=form.elements.language.value,c=copy[language];
  document.documentElement.lang=language;document.title=c.title;
  for(const element of document.querySelectorAll("[data-copy]"))element.textContent=c[element.dataset.copy];
  document.body.dataset.view=form.elements.view.value;
  document.documentElement.style.setProperty("--study-width",`${form.elements.width.value}px`);
  const query=new URLSearchParams({language,state:form.elements.state.value});
  for(const variant of ["baseline","proposal"]){const frame=document.getElementById(variant);frame.title=c[`${variant}Frame`];frame.src=`screen.html?${query}&variant=${variant}`;}
  const saved=new URLSearchParams(new FormData(form));history.replaceState(null,"",`?${saved}`);
}
form.addEventListener("submit",event=>event.preventDefault());
form.addEventListener("change",render);
document.querySelector("#study-reset").addEventListener("click",render);
render();
