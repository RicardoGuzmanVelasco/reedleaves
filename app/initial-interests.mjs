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

// No route or gate opens this controller yet. Increment 22c owns activation,
// applying the fresh reader state and presenting newlyGranted on Home.
export function createInitialInterestFlow({store,request,onChange=()=>{},onComplete=()=>{},onSessionExpired=()=>{}}) {
  let state=null,generation=0,pending=null;
  const notify=()=>onChange(state);
  const persist=()=>{
    store.save(storageKeys.initialInterests(state.userId),{...state.draft,userId:state.userId});
    state={...state,storageAvailable:store.available!==false};
  };
  const current=(token,userId)=>token===generation&&state?.userId===userId;
  function finish(result) {
    const userId=state.userId;
    store.remove(storageKeys.initialInterests(userId));
    state=null;notify();onComplete(result,userId);
    return {saved:true,result};
  }
  return {
    get state(){return state;},
    open({userId,catalog,preferences}) {
      generation++;pending=null;
      if(!userId||preferences?.configured||preferences?.initialOpportunityClosed){state=null;notify();return false;}
      const saved=store.read(storageKeys.initialInterests(userId));
      state={userId,catalog,revision:preferences?.revision??0,draft:normalizeInitialInterestDraft(saved?.userId===userId?saved:null,catalog),saving:false,error:null,feedback:null,conflict:false};
      persist();notify();return true;
    },
    // Lifecycle cleanup only; there is deliberately no user-facing skip/close.
    dispose(){generation++;pending=null;state=null;notify();},
    toggle(id,kind) {
      if(!state||state.saving||!state.catalog.genres.some(item=>item.id===id))return;
      const result=toggleProfileInterest(state.draft,id,kind);
      state={...state,draft:result.state,feedback:result.reason==="limit"?"profileInterestLimit":result.moved?"profileInterestMoved":null,error:null};
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
        if(preferences.configured||preferences.initialOpportunityClosed)return finish({state:preferences,newlyGranted:[],rewards:[],replayed:true});
        state={...state,revision:preferences.revision,saving:false,conflict:false};notify();
      } catch(error) {
        if(!current(token,userId))return;
        state={...state,saving:false,error:"profileInterestSaveError"};notify();
        if(error.status===401)onSessionExpired(userId);
      }
    },
    save() {
      if(pending)return pending;
      if(!state||state.draft.step!==2||!state.draft.interested.length)return Promise.resolve({saved:false});
      const token=generation,userId=state.userId,input={interested:[...state.draft.interested],notInterested:[...state.draft.notInterested],revision:state.revision};
      state={...state,saving:true,error:null,conflict:false};notify();
      pending=(async()=>{
        try {
          const result=await request("/api/reader/interests/initial",input);
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
