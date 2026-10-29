import {storageKeys} from "./storage.mjs";
import {toggleProfileInterest} from "./profile-interests.mjs";

const kinds=["interested","notInterested"];
const validSaved=saved=>saved&&typeof saved.visitId==="string"&&/^[a-f0-9-]{36}$/i.test(saved.visitId)&&Array.isArray(saved.ids)&&saved.ids.every(id=>typeof id==="string")&&Number.isSafeInteger(saved.revision)&&saved.revision>=0&&[1,2].includes(saved.draft?.step)&&kinds.every(kind=>Array.isArray(saved.draft[kind])&&saved.draft[kind].every(id=>typeof id==="string")&&Array.isArray(saved.base?.[kind])&&saved.base[kind].every(id=>typeof id==="string"));
const copy=value=>({interested:[...(value?.interested||[])],notInterested:[...(value?.notInterested||[])]});
export function createNewInterestFlow({store,request,loadCatalog,createVisitId=()=>crypto.randomUUID(),onChange=()=>{},onComplete=()=>{},onSessionExpired=()=>{}}) {
  let state=null,generation=0,pending=null,visitedUser=null;
  const notify=()=>onChange(state);
  const persist=()=>{store.save(storageKeys.newInterests(state.userId),{userId:state.userId,visitId:state.visitId,ids:state.ids,base:state.base,draft:state.draft,revision:state.revision});state={...state,storageAvailable:store.available!==false};};
  const current=(token,id)=>token===generation&&state?.userId===id;
  const finish=result=>{const userId=state.userId;store.remove(storageKeys.newInterests(userId));state=null;notify();onComplete(result,userId);return {saved:true,result};};
  async function load() {
    if(!state||state.saving)return;
    const token=generation,userId=state.userId;
    state={...state,saving:true,error:null};notify();
    try {
      const snapshot=await request("/api/reader/interests/knowledge/snapshot",{visitId:state.visitId});
      if(!current(token,userId))return;
      if(!snapshot.newInterestIds.length)return finish(null);
      state={...state,ids:snapshot.newInterestIds,blocking:true};persist();notify();
      const catalog=await loadCatalog();
      if(!current(token,userId))return;
      const ids=snapshot.newInterestIds.filter(id=>catalog.genres.some(item=>item.id===id));
      if(!ids.length)return finish(null);
      const available=new Set(catalog.genres.map(item=>item.id)),used=new Set();
      const draft={step:state.draft.step};
      for(const kind of kinds)draft[kind]=state.draft[kind].filter(id=>available.has(id)&&!used.has(id)&&used.add(id));
      state={...state,catalog,ids,draft,saving:false,ready:true};persist();notify();
    } catch(error) {
      if(!current(token,userId))return;
      state={...state,saving:false,blocking:true,error:"connectionError"};notify();
      if(error.status===401)onSessionExpired(userId);
    }
  }
  const flow={
    get state(){return state;},
    open({userId,preferences}) {
      if(!userId||!preferences?.configured||visitedUser===userId)return;
      generation++;pending=null;visitedUser=userId;
      const saved=store.read(storageKeys.newInterests(userId)),valid=saved?.userId===userId&&validSaved(saved);
      state={userId,visitId:valid?saved.visitId:createVisitId(),ids:valid?saved.ids:[],base:valid?saved.base:copy(preferences),draft:valid?saved.draft:{...copy(preferences),step:1},revision:valid?saved.revision:preferences.revision,catalog:null,ready:false,blocking:valid&&saved.ids.length>0,saving:false,error:null,conflict:false,replacement:null};
      persist();return load();
    },
    dispose(){generation++;pending=null;visitedUser=null;state=null;notify();},
    retry:load,
    toggle(id,kind) {
      if(!state?.ready||state.saving||state.replacement||!state.ids.includes(id)||!kinds.includes(kind))return;
      const result=toggleProfileInterest(state.draft,id,kind);
      if(result.reason==="limit")state={...state,replacement:{id,kind},feedback:null};
      else state={...state,draft:result.state,feedback:result.moved?"profileInterestMoved":null,error:null};
      persist();notify();
    },
    replace(id) {
      if(!state?.replacement||state.saving)return;
      const {kind,id:added}=state.replacement;
      if(!state.draft[kind].includes(id))return;
      const draft={...state.draft,[kind]:state.draft[kind].filter(value=>value!==id)};
      state={...state,draft:toggleProfileInterest(draft,added,kind).state,replacement:null};persist();notify();
    },
    cancelReplacement(){if(!state||state.saving)return;state={...state,replacement:null};notify();},
    remove(id,kind){if(!state||state.saving)return;state={...state,draft:{...state.draft,[kind]:state.draft[kind].filter(value=>value!==id)}};persist();notify();},
    next(){if(!state?.ready||state.saving||state.replacement||!state.draft.interested.length)return;state={...state,draft:{...state.draft,step:2},feedback:null};persist();notify();},
    back(){if(!state||state.saving||state.replacement)return;state={...state,draft:{...state.draft,step:1},feedback:null};persist();notify();},
    async recover() {
      if(!state||state.saving)return;
      const token=generation,userId=state.userId;
      state={...state,saving:true,error:null};notify();
      try {
        const preferences=await request("/api/reader/interests/preferences");
        if(!current(token,userId))return;
        const draft={step:state.draft.step},removed=new Set(kinds.flatMap(kind=>state.base[kind].filter(id=>!state.draft[kind].includes(id))));
        const additions=Object.fromEntries(kinds.map(kind=>[kind,state.draft[kind].filter(id=>!state.base[kind].includes(id))]));
        for(const kind of kinds){const other=kind==="interested"?"notInterested":"interested";draft[kind]=[...preferences[kind].filter(id=>!removed.has(id)&&!additions[other].includes(id)&&!additions[kind].includes(id)),...additions[kind]];}
        state={...state,base:copy(preferences),revision:preferences.revision,draft:{...draft,step:draft.interested.length>5?1:draft.notInterested.length>5?2:draft.step},saving:false,conflict:false};persist();notify();
      } catch(error){if(!current(token,userId))return;state={...state,saving:false,error:"profileInterestSaveError"};notify();if(error.status===401)onSessionExpired(userId);}
    },
    save() {
      if(pending)return pending;
      if(!state?.ready||!state.draft.interested.length||state.draft.step!==2||state.replacement||state.conflict||kinds.some(kind=>state.draft[kind].length>5))return Promise.resolve({saved:false});
      const token=generation,userId=state.userId,input={visitId:state.visitId,shownInterestIds:[...state.ids],preferences:{...copy(state.draft),revision:state.revision}};
      state={...state,saving:true,error:null};notify();
      pending=(async()=>{try{
        const result=await request("/api/reader/interests/knowledge/recognize",input);
        if(!current(token,userId))return {saved:false,stale:true};return finish(result);
      }catch(error){if(!current(token,userId))return {saved:false,stale:true};state={...state,saving:false,error:error.status===409?null:"profileInterestSaveError",conflict:error.status===409};notify();if(error.status===401)onSessionExpired(userId);return {saved:false,error};}
      finally{if(current(token,userId))pending=null;}})();return pending;
    }
  };
  return flow;
}
