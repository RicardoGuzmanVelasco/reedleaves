export function cardActionRecord(record,card,userId) {
  return {...record,isOwn:record?.isOwn ?? (!!userId && card?.creatorUserId===userId)};
}

export function savedReferences(rows=[]) {
  return Object.fromEntries(rows.map(row=>[row.cardId,{cardId:row.cardId,bookId:row.bookId,savedAt:row.savedAt}]));
}
export function updateSavedReferences(rows,result) {
  const rest=rows.filter(row=>row.cardId!==result.cardId);
  return result.saved ? [{cardId:result.cardId,bookId:result.bookId,savedAt:result.savedAt},...rest] : rest;
}
export function optimisticCardAction(state,action) {
  const record=state.records[action.cardId] || {vote:null,likes:0,dislikes:0};
  if(action.kind==='vote'){
    const vote=action.value===0 ? null : action.value;
    const likes=Math.max(0,record.likes-(record.vote===1?1:0)+(vote===1?1:0));
    const dislikes=Math.max(0,record.dislikes-(record.vote===-1?1:0)+(vote===-1?1:0));
    return {...state,records:{...state.records,[action.cardId]:{...record,vote,likes,dislikes}}};
  }
  const saves={...state.saves};
  if(action.saved)saves[action.cardId]={cardId:action.cardId,bookId:action.bookId,savedAt:state.saves[action.cardId]?.savedAt || action.savedAt};
  else delete saves[action.cardId];
  return {...state,saves,records:{...state.records,[action.cardId]:{...record,saved:action.saved}}};
}

export function createCardActionTransport(api,onPending=()=>{}) {
  let active=0;
  return {
    get pending(){return active>0},
    async write(userId,action,confirmation){
      active++;onPending(active);
      try{return await api.request(action.kind==='vote'?'/api/cards/vote':'/api/cards/save',action.kind==='vote'?{cardId:action.cardId,value:action.value}:{cardId:action.cardId,saved:action.saved,...(confirmation?{confirmation}:{})},{queueKey:`cards:${userId}:${action.cardId}:${action.kind}`})}
      finally{active--;onPending(active)}
    },
    read(userId,cardId){return api.request(`/api/cards/${encodeURIComponent(cardId)}/actions`,undefined,{queueKey:`card-read:${userId}:${cardId}`})}
  };
}

/** Suppress only the read that follows an already-loaded record's commit callback. */
export function createCardSaveNotificationGate() {
  const suppressed=new Set();
  return {
    afterCommit(cardId,recordLoaded) {
      if(recordLoaded)suppressed.add(cardId);
      return {loadRecordWithoutNotification:!recordLoaded};
    },
    shouldNotify(cardId) { return !suppressed.delete(cardId); }
  };
}

/** Keep a save action pending until its operation-scoped server confirmation is accepted. */
export function createCardSaveConfirmationFlow({request,recover,onWarning=()=>{},onCommit=()=>{},onFailure=()=>{}}={}) {
  let pending=null,busy=false;

  async function submit(action,confirmation) {
    if(busy)return {saved:false,busy:true};
    busy=true;
    try {
      let result=await request(action,confirmation);
      if(result?.confirmationRequired) {
        pending={action,warning:result};
        onWarning(pending);
        return {confirmationRequired:true,pending};
      }
      pending=null;
      onWarning(null);
      onCommit(result,action);
      return {saved:true,result};
    } catch(error) {
      // A request may commit on the server even when its response is lost.
      let recovered=null;
      try { recovered=await recover?.(action); } catch { /* Preserve the retry path below. */ }
      if(recovered?.saved===action.saved) {
        pending=null;onWarning(null);onCommit(recovered,action);
        return {saved:true,result:recovered,recovered:true};
      }
      if(pending&&confirmation)pending={...pending,outcomeUnknown:true};
      await onFailure(error,pending,action);
      return {saved:false,error,pending};
    } finally { busy=false; }
  }

  return {
    start(action) { return submit(action); },
    confirm() { return pending ? submit(pending.action,pending.warning.confirmation) : Promise.resolve({saved:false}); },
    cancel() {
      if(busy||!pending||pending.outcomeUnknown)return null;
      const cancelled=pending;pending=null;onWarning(null);return cancelled;
    },
    get pending() { return pending; },
    get busy() { return busy; }
  };
}
