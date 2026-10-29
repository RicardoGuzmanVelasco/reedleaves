// Recover the authoritative session after initial setup. Receipt claims are
// keyed by their server ledger type so an idempotent replay presents only once.
export function createInitialInterestCompletion({readSession,isCurrent,applySession,applyReceiptBalances,presentReceipt}) {
  const presented=new Set();
  return async function completeInitialInterestSave({result,userId}) {
    if(!userId||!isCurrent(userId))return {completed:false,stale:true};
    const receipt=Array.isArray(result?.newlyGranted)&&result.newlyGranted.length
      ?result.newlyGranted
      :result?.replayed&&Array.isArray(result.rewards)?result.rewards:[];
    let refreshed=false;
    try{
      const state=await readSession();
      if(!isCurrent(userId)||state?.user?.id!==userId)return {completed:false,stale:true};
      applySession(state);refreshed=true;
    }catch{/* Keep the transaction receipt as the only available balance evidence. */}
    const unpresented=receipt.filter(row=>typeof row.rewardType==="string"&&!presented.has(`${userId}:${row.rewardType}`));
    if(!refreshed&&unpresented.length)applyReceiptBalances(unpresented,userId);
    if(unpresented.length){
      for(const row of unpresented)presented.add(`${userId}:${row.rewardType}`);
      presentReceipt({userId,newlyGranted:unpresented});
    }
    return {completed:true,refreshed};
  };
}
