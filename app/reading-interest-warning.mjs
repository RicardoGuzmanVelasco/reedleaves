/** Keep a server-confirmed reading action pending until the reader accepts it. */
export function createReadingInterestWarningFlow({request,onCommit=()=>{},onWarning=()=>{},onFailure=()=>{}}={}) {
  let pending=null;

  async function submit(bookId,status,confirmation) {
    try {
      const result=await request({bookId,status,...(confirmation?{confirmation}:{})});
      if(result?.confirmationRequired) {
        pending={bookId,status,warning:result};
        onWarning(pending);
        return {confirmationRequired:true,pending};
      }
      pending=null;
      onCommit(result);
      return {saved:true,result};
    } catch(error) {
      await onFailure(error,pending);
      return {saved:false,error,pending};
    }
  }

  return {
    start(bookId,status) { return submit(bookId,status); },
    cancel() { const cancelled=pending;pending=null;return cancelled; },
    confirm() { return pending ? submit(pending.bookId,pending.status,pending.warning.confirmation) : Promise.resolve({saved:false}); },
    get pending() { return pending; }
  };
}
