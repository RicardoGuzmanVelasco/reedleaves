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
  return {code:label,reference:failure?.reference||null,detail,retry};
}
