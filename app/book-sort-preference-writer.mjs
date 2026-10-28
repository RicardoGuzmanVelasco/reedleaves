export function createBookSortPreferenceWriter({write,isCurrent,onResult,onError}) {
  let sequence=0,queue=Promise.resolve();
  return {
    save(order,accountId) {
      const token=++sequence,current=()=>token===sequence&&isCurrent(accountId,order);
      const pending=queue.catch(()=>{}).then(async()=>{
        if(!current())return {status:"superseded"};
        try {
          const result=await write(order,accountId);
          if(!current())return {status:"superseded"};
          onResult?.(result,{order,accountId,token});
          return {status:"saved",result};
        } catch(error) {
          if(!current())return {status:"superseded"};
          onError?.(error,{order,accountId,token});
          return {status:"failed",error};
        }
      });
      queue=pending;
      return pending;
    },
    invalidate() { sequence++; }
  };
}
