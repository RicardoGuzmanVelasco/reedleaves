// Availability is advisory. The purchase endpoint always checks candidates again.
export function createDiscoverAvailability({read,onChange=()=>{}}) {
  let state={status:"idle"},generation=0,request=null;
  const invalidate=()=>{generation++;request=null;state={status:"idle"};};
  const load=()=>{
    if(request)return request;
    const ticket=generation;
    state={status:"loading"};
    const pending=Promise.resolve().then(read).then(result=>{
      if(ticket!==generation)return;
      if(!Number.isSafeInteger(result?.available)||result.available<0||result.required!==5)throw new Error("invalidAvailability");
      state={status:"ready",available:result.available,required:result.required};
      onChange();
    }).catch(()=>{
      if(ticket!==generation)return;
      state={status:"error"};onChange();
    }).finally(()=>{if(request===pending)request=null;});
    request=pending;return pending;
  };
  return {get state(){return state;},invalidate,load};
}
