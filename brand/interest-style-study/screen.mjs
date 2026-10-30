import {mountInitialInterests} from "/app/initial-interests-ui.mjs";
import {createBrowserStore} from "/app/storage.mjs";
import {applyProposalUI,mountProposalSelectionGuard} from "./proposal-ui.mjs";

const params=new URLSearchParams(location.search),language=params.get("language")==="en"?"en":"es",variant=["baseline","reference"].includes(params.get("variant"))?params.get("variant"):"proposal";
document.documentElement.lang=language;
document.documentElement.dataset.interestStudy=variant==="reference"?"proposal":variant;
if(variant==="proposal"){
  document.documentElement.dataset.studyRefresh="";
  document.documentElement.dataset.studyFormat=["cards","flat"].includes(params.get("format"))?params.get("format"):"chips";
  document.documentElement.dataset.studyCounter=params.get("counter")==="translucent"?"translucent":"solid";
  document.documentElement.dataset.studyTypography=params.get("typography")==="compact"?"compact":"large";
}
const response=await fetch(`/studio/catalog?variant=${variant==="baseline"?"baseline":"proposal"}`);
if(!response.ok)throw new Error("Local study catalog unavailable");
const catalog=await response.json(),memory=new Map();
if(variant==="proposal"){
  const growth=catalog.genres.find(item=>item.id==="personal-growth"),others=catalog.genres.filter(item=>item!==growth);
  catalog.genres=[growth,...others];
}
const store=createBrowserStore(()=>({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}));
const result=document.querySelector("#study-result");
const host=document.querySelector("#study-host");
const flow=mountInitialInterests({host,language,store,
  onChange:state=>{if(variant==="proposal"&&state)applyProposalUI(host,state,language);},
  request:async()=>({state:{configured:true},newlyGranted:[],rewards:[]}),
  onComplete:()=>{result.hidden=false;result.querySelector("p").textContent=language==="es"?"Selección guardada en esta muestra":"Selection saved in this preview";result.querySelector("button").textContent=language==="es"?"Volver a probar":"Try again";}
});
if(variant==="proposal")mountProposalSelectionGuard(host,()=>flow.state);
result.querySelector("button").addEventListener("click",()=>location.reload());
// Match authenticated startup, including the reset that exposed the real bug.
flow.dispose();flow.open({userId:"local-style-study",catalog,preferences:{configured:false,revision:0}});
const count={empty:0,one:1,two:2,mixed:3,four:4,five:5,second:3}[params.get("state")]??3;
for(const id of ["personal-growth","finance","metaphysics","mindfulness","productivity"].slice(0,count))flow.toggle(id,"interested");
if(params.get("state")==="second")flow.next();
