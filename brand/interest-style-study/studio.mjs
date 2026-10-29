const copy={
  es:{title:"Intereses · Propuesta local",language:"Idioma",width:"Ancho",height:"Alto",state:"Estado inicial",mixed:"Tres seleccionados",empty:"Sin seleccionar",one:"Uno seleccionado",two:"Dos seleccionados",four:"Cuatro seleccionados",five:"Cinco seleccionados",second:"Segundo paso",format:"Formato",chips:"Chips con relieve",flat:"Chips planos",cards:"Tarjetas",counter:"Número",solid:"Color oscurecido",translucent:"Semitransparente",growth:"Crecimiento personal",last:"Al final",first:"Al principio",view:"Vista",compare:"Comparar",proposal:"Propuesta",reset:"Reiniciar",baseline:"Propuesta anterior",baselineFrame:"Propuesta anterior con tarjetas",proposalFrame:"Propuesta de selector"},
  en:{title:"Interests · Local proposal",language:"Language",width:"Width",height:"Height",state:"Initial state",mixed:"Three selected",empty:"None selected",one:"One selected",two:"Two selected",four:"Four selected",five:"Five selected",second:"Second step",format:"Style",chips:"Raised chips",flat:"Flat chips",cards:"Cards",counter:"Number",solid:"Darker chip color",translucent:"Translucent",growth:"Personal growth",last:"Last",first:"First",view:"View",compare:"Compare",proposal:"Proposal",reset:"Reset",baseline:"Previous proposal",baselineFrame:"Previous card proposal",proposalFrame:"Proposed selector"}
};
const form=document.querySelector("#study-controls"),params=new URLSearchParams(location.search);
for(const select of form.querySelectorAll("select")){const value=params.get(select.name);if([...select.options].some(option=>option.value===value))select.value=value;}
function render(){
  const language=form.elements.language.value,c=copy[language];
  document.documentElement.lang=language;document.title=c.title;
  for(const element of document.querySelectorAll("[data-copy]"))element.textContent=c[element.dataset.copy];
  document.body.dataset.view=form.elements.view.value;
  document.documentElement.style.setProperty("--study-width",`${form.elements.width.value}px`);
  document.documentElement.style.setProperty("--study-height",`${form.elements.height.value}px`);
  const query=new URLSearchParams(new FormData(form));
  for(const variant of ["baseline","proposal"]){const frame=document.getElementById(variant);frame.title=c[`${variant}Frame`];frame.src=`screen.html?${query}&variant=${variant==="baseline"?"reference":"proposal"}`;}
  const saved=new URLSearchParams(new FormData(form));history.replaceState(null,"",`?${saved}`);
}
form.addEventListener("submit",event=>event.preventDefault());
form.addEventListener("change",render);
document.querySelector("#study-reset").addEventListener("click",render);
render();
