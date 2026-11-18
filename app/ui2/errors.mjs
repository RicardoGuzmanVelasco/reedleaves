// Save errors → what the error modal shows. Pure.
const SERVER_ONLY=new Set(["tryLater","deckCardLimitReached","contributorCardLimitReached","deckReadOnly","deckUnavailable","bookUnavailable","invalidParent","noteConflict"]);

// `failure`: an AccountError ({code,status,reference}); `c`: translations.
export function errorInfo(failure,c){
  const code=failure?.code||"connectionError",status=Number(failure?.status)||0;
  let detail,label=status?`${code} · ${status}`:code,retry=false;
  if(status>=500){detail=c.ui2ServerError;label=`HTTP ${status}`;retry=true;}
  else if(code==="connectionError"){detail=c.connectionError;label="connectionError";retry=true;}
  else if(code==="sessionExpired"||code==="signInRequired")detail=c.sessionExpired;
  else if(code==="invalidRequest"){detail=c.invalidRequest;retry=true;}
  else if(SERVER_ONLY.has(code)&&typeof c[code]==="string")detail=c[code];
  else{detail=c.invalidRequest;retry=true;}
  return {code:label,reference:failure?.reference||null,detail:failure?.detail||detail,retry};
}

// No connection or a server error: the full-screen error with Retry (error-screen.mjs), not the modal.
export const blockingFailure=failure=>!failure?.code||failure.code==="connectionError"||Number(failure.status)>=500;

// Starting a practice answers 200 with a `reason` when it cannot start (no cards, not enough petals, price changed…).
export function practiceStartDetail(result,cost,c){
  const reason=result?.reason;
  if(reason==="notEnoughCards")return c.practiceNeedMoreCards(result.available??0,result.required??0);
  if(reason==="insufficientPetals")return c.practiceInsufficientPetals(result.cost??cost,result.balance??0);
  if(reason==="practicePriceChanged"||reason==="practiceSessionCancelled"||reason==="practiceSessionUnavailable")return c[reason];
  return c.practiceNoCards;
}
