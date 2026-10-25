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
    async write(userId,action){
      active++;onPending(active);
      try{return await api.request(action.kind==='vote'?'/api/cards/vote':'/api/cards/save',action.kind==='vote'?{cardId:action.cardId,value:action.value}:{cardId:action.cardId,saved:action.saved},{queueKey:`cards:${userId}:${action.cardId}:${action.kind}`})}
      finally{active--;onPending(active)}
    },
    read(userId,cardId){return api.request(`/api/cards/${encodeURIComponent(cardId)}/actions`,undefined,{queueKey:`card-read:${userId}:${cardId}`})}
  };
}
