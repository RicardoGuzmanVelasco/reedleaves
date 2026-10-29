// Recover the authoritative session after initial setup. If that read is
// unavailable, the transaction's newlyGranted receipt is still authoritative.
export async function completeInitialInterestSave({result,userId,readSession,isCurrent,applySession,applyReceiptBalances,presentReceipt}) {
  if(!userId||!isCurrent(userId))return {completed:false,stale:true};
  const receipt=Array.isArray(result?.newlyGranted)&&result.newlyGranted.length
    ?result.newlyGranted
    :result?.replayed&&Array.isArray(result.rewards)?result.rewards:[];
  let refreshed=false;
  try{
    const state=await readSession();
    if(!isCurrent(userId)||state?.user?.id!==userId)return {completed:false,stale:true};
    applySession(state);refreshed=true;
  }catch{/* Keep the transaction result as the only available balance evidence. */}
  if(!refreshed&&result?.newlyGranted?.length)applyReceiptBalances(result.newlyGranted,userId);
  presentReceipt({userId,newlyGranted:receipt});
  return {completed:true,refreshed};
}
