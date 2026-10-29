import {mountInitialInterests} from "/app/initial-interests-ui.mjs";
import {createBrowserStore} from "/app/storage.mjs";

const params=new URLSearchParams(location.search),language=params.get("language")==="en"?"en":"es",variant=params.get("variant")==="baseline"?"baseline":"proposal";
document.documentElement.lang=language;
document.documentElement.dataset.interestStudy=variant;
const response=await fetch(`/studio/catalog?variant=${variant}`);
if(!response.ok)throw new Error("Local study catalog unavailable");
const catalog=await response.json(),memory=new Map();
const store=createBrowserStore(()=>({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}));
const result=document.querySelector("#study-result");
const flow=mountInitialInterests({host:document.querySelector("#study-host"),language,store,
  request:async()=>({state:{configured:true},newlyGranted:[],rewards:[]}),
  onComplete:()=>{result.hidden=false;result.querySelector("p").textContent=language==="es"?"Selección guardada en esta muestra":"Selection saved in this preview";result.querySelector("button").textContent=language==="es"?"Volver a probar":"Try again";}
});
result.querySelector("button").addEventListener("click",()=>location.reload());
// Match authenticated startup, including the reset that exposed the real bug.
flow.dispose();flow.open({userId:"local-style-study",catalog,preferences:{configured:false,revision:0}});
if(params.get("state")!=="empty")for(const id of ["finance","metaphysics","personal-growth"])flow.toggle(id,"interested");
if(params.get("state")==="second")flow.next();
