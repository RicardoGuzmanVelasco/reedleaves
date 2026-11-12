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
  if(intent==="addToCardcase") return requestConfirmedMutation(request,"/api/reader/cardcase/add",{deckId},confirm);
  return request("/api/reader/deck/open",{deckId});
}
