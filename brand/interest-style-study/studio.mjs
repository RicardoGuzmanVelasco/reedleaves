const copy={
  es:{title:"Intereses · Propuesta local",language:"Idioma",width:"Ancho",height:"Alto",state:"Estado inicial",mixed:"Tres seleccionados",empty:"Sin seleccionar",one:"Uno seleccionado",two:"Dos seleccionados",four:"Cuatro seleccionados",five:"Cinco seleccionados",second:"Segundo paso",format:"Formato",chips:"Chips con relieve",flat:"Chips planos",cards:"Tarjetas",typography:"Texto",large:"Oscuro ampliado",compact:"Tamaño anterior",counter:"Número",solid:"Color oscurecido",translucent:"Semitransparente",view:"Vista",compare:"Comparar",proposal:"Propuesta",reset:"Reiniciar",baseline:"Comparación"},
  en:{title:"Interests · Local proposal",language:"Language",width:"Width",height:"Height",state:"Initial state",mixed:"Three selected",empty:"None selected",one:"One selected",two:"Two selected",four:"Four selected",five:"Five selected",second:"Second step",format:"Style",chips:"Raised chips",flat:"Flat chips",cards:"Cards",typography:"Text",large:"Larger dark text",compact:"Previous size",counter:"Number",solid:"Darker chip color",translucent:"Translucent",view:"View",compare:"Compare",proposal:"Proposal",reset:"Reset",baseline:"Comparison"}
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
  const typography=form.elements.typography.value,comparison=typography==="large"?"compact":"large";
  for(const variant of ["baseline","proposal"]){
    const type=variant==="baseline"?comparison:typography,frame=document.getElementById(variant);
    document.getElementById(`${variant}-title`).textContent=c[type];frame.title=c[type];
    const frameQuery=new URLSearchParams(query);frameQuery.set("typography",type);frameQuery.set("variant","proposal");frame.src=`screen.html?${frameQuery}`;
  }
  const saved=new URLSearchParams(new FormData(form));history.replaceState(null,"",`?${saved}`);
}
form.addEventListener("submit",event=>event.preventDefault());
form.addEventListener("change",render);
document.querySelector("#study-reset").addEventListener("click",render);
render();
