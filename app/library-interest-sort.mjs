export function createInterestSortLoginIntent(){
  let returnHash=null;
  return {
    request(hash="#library"){returnHash=hash||"#library";},
    consume(userId){if(!returnHash||!userId)return null;const hash=returnHash;returnHash=null;return hash;},
    clear(){returnHash=null;},
    get pending(){return returnHash!==null;}
  };
}

export async function completeInterestSortLogin({userId,loadPreferences,applySort,persistSort}){
  if(!userId)return {status:"unauthenticated"};
  try {
    await loadPreferences(userId);
  } catch(error) {
    return {status:"preferences-failed",error};
  }
  applySort();
  return {status:"applied",saveResult:await persistSort(userId)};
}
