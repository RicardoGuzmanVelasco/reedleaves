// Browser Back and direct hashes cannot dismiss an already presented batch.
export function newInterestRouteRedirect({userId,flow,hash}) {
  return !!(userId&&flow?.userId===userId&&flow.blocking&&hash!=="#home");
}
