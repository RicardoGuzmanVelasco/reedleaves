/** Complete a mutation that may require one or more operation-scoped confirmations. */
export async function requestConfirmedMutation(request,path,input,confirm) {
  let result=await request(path,input);
  while(result?.confirmationRequired) {
    if(!confirm(result)) return null;
    result=await request(path,{...input,confirmation:result.confirmation});
  }
  return result;
}

/** Run a deck intent after sign-in, confirming collection before charging for it. */
export async function requestPendingDeckIntent(request,deckId,intent,confirm) {
  if(intent==="collect") return requestConfirmedMutation(request,"/api/reader/collect",{deckId},confirm);
  return request("/api/reader/select",{deckId});
}
