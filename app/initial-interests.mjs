import {storageKeys} from "./storage.mjs";
import {toggleProfileInterest} from "./profile-interests.mjs";

// This is a private draft, never a saved/public preference. Catalog validation
// happens on restore so removed interests cannot trap the reader in step two.
export function normalizeInitialInterestDraft(saved,catalog) {
  const available=new Set(catalog.genres.map(item=>item.id)),used=new Set();
  let limit=5;
  const list=values=>(Array.isArray(values)?values:[]).filter(id=>{
    if(typeof id!=="string"||!available.has(id)||used.has(id)||used.size>=limit)return false;
    used.add(id);return true;
  }).slice(0,5);
  const interested=list(saved?.interested);limit=used.size+5;
  const notInterested=list(saved?.notInterested);
  return {interested,notInterested,step:saved?.step===2&&interested.length?2:1};
}

// One chooser: mandatory initial setup on Home, cancellable editing on Profile.
export function createInitialInterestFlow({store,request,onChange=()=>{},onComplete=()=>{},onSessionExpired=()=>{},onCancel=()=>{}}) {
  let state=null,generation=0,pending=null;
  const notify=()=>onChange(state);
  const draftKey=()=>state.mode==="edit"?storageKeys.editInterests(state.userId):storageKeys.initialInterests(state.userId);
  const persist=()=>{
    store.save(draftKey(),{...state.draft,userId:state.userId,revision:state.revision});
    state={...state,storageAvailable:store.available!==false};
  };
  const current=(token,userId)=>token===generation&&state?.userId===userId;
  function finish(result) {
    const userId=state.userId;
    store.remove(draftKey());
    state=null;notify();onComplete(result,userId);
    return {saved:true,result};
  }
  return {
    get state(){return state;},
    open({userId,catalog,preferences,mode="initial"}) {
      generation++;pending=null;
      if(!userId||mode!=="edit"&&(preferences?.configured||preferences?.initialOpportunityClosed)){state=null;notify();return false;}
      const saved=store.read(mode==="edit"?storageKeys.editInterests(userId):storageKeys.initialInterests(userId));
      const restored=saved?.userId===userId&&(mode!=="edit"||saved.revision===preferences?.revision)?saved:null;
      state={userId,catalog,mode,revision:preferences?.revision??0,draft:normalizeInitialInterestDraft(restored||(mode==="edit"?preferences:null),catalog),saving:false,error:null,feedback:null,conflict:false};
      persist();notify();return true;
    },
    cancel(){if(!state||state.mode!=="edit"||state.saving)return;const userId=state.userId;store.remove(draftKey());generation++;pending=null;state=null;notify();onCancel(userId);},
    // Session cleanup keeps the private draft and lifetime host handlers.
    dispose(){generation++;pending=null;state=null;notify();},
    toggle(id,kind) {
      if(!state||state.saving||!["interested","notInterested"].includes(kind)||!state.catalog.genres.some(item=>item.id===id))return;
      if(state.draft[kind==="interested"?"notInterested":"interested"].includes(id)){notify();return;}
      const result=toggleProfileInterest(state.draft,id,kind);
      state={...state,draft:result.state,feedback:result.reason==="limit"?"profileInterestLimit":null,error:null};
      persist();notify();
    },
    next(){if(!state||state.saving||!state.draft.interested.length)return;state={...state,draft:{...state.draft,step:2},feedback:null};persist();notify();},
    back(){if(!state||state.saving)return;state={...state,draft:{...state.draft,step:1},feedback:null};persist();notify();},
    async recover() {
      if(!state||state.saving)return;
      const token=generation,userId=state.userId;
      state={...state,saving:true,error:null};notify();
      try {
        const preferences=await request("/api/reader/interests/preferences");
        if(!current(token,userId))return;
        if(state.mode!=="edit"&&(preferences.configured||preferences.initialOpportunityClosed))return finish({state:preferences,newlyGranted:[],rewards:[],replayed:true});
        state={...state,revision:preferences.revision,...(state.mode==="edit"?{draft:normalizeInitialInterestDraft(preferences,state.catalog)}:{}),saving:false,conflict:false};persist();notify();
      } catch(error) {
        if(!current(token,userId))return;
        state={...state,saving:false,error:"profileInterestSaveError"};notify();
        if(error.status===401)onSessionExpired(userId);
      }
    },
    save() {
      if(pending)return pending;
      if(!state||state.conflict||state.draft.step!==2||!state.draft.interested.length)return Promise.resolve({saved:false});
      const token=generation,userId=state.userId,input={interested:[...state.draft.interested],notInterested:[...state.draft.notInterested],revision:state.revision};
      state={...state,saving:true,error:null,conflict:false};notify();
      pending=(async()=>{
        try {
          const editing=state.mode==="edit";
          const response=await request(editing?"/api/reader/interests/preferences":"/api/reader/interests/initial",input);
          const result=editing?{state:response,newlyGranted:[],rewards:[]}:response;
          if(!current(token,userId))return {saved:false,stale:true};
          return finish(result);
        } catch(error) {
          if(!current(token,userId))return {saved:false,stale:true};
          state={...state,saving:false,error:error.status===409?null:"profileInterestSaveError",conflict:error.status===409};notify();
          if(error.status===401)onSessionExpired(userId);
          return {saved:false,error};
        } finally {if(current(token,userId))pending=null;}
      })();
      return pending;
    }
  };
}
