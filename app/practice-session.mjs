export function restorePracticeSession(session,cardsById,{introSession=null}={}) {
  if(!session||!Array.isArray(session.cardIds)||session.cardIds.length!==5||
    !session.cardIds.every(id=>typeof id==="string"&&id.length>0)||new Set(session.cardIds).size!==5||
    !Number.isSafeInteger(session.index)||session.index<0||session.index>=session.cardIds.length) return null;
  const cards=session.cardIds.map(id=>cardsById?.get(id));
  if(cards.some(card=>!card)) return null;
  const isIntro=session.id===introSession?.id&&session.index===introSession?.index&&
    Array.isArray(introSession?.cardIds)&&session.cardIds.length===introSession.cardIds.length&&
    session.cardIds.every((id,index)=>id===introSession.cardIds[index]);
  return {...session,cards,...(isIntro?{shuffle:true}:{}),advancing:false,leaving:null,answer:null};
}

export function samePracticeRecoveryTicket(request,current) {
  return request?.userId===current?.userId&&request?.stateRevision===current?.stateRevision&&
    request?.generation===current?.generation;
}

export const canApplyPracticeRecovery=samePracticeRecoveryTicket;

export function practiceSessionAfterAnimation(appliedRevision,currentRevision,responseSession,currentSession) {
  return appliedRevision===currentRevision?responseSession:currentSession;
}

export function hasPendingPracticeOperation({startRequest,answerRequest,recoveryRequest}={}) {
  return !!(startRequest||answerRequest||recoveryRequest);
}

export function canApplyReaderSync(requestGeneration,currentGeneration,{busy=false,practicePending=false}={}) {
  return requestGeneration===currentGeneration&&!busy&&!practicePending;
}
