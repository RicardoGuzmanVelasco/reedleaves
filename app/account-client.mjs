export class AccountError extends Error {
  constructor(code,status = 0,reference) { super(code); this.code = code; this.status = status;
    if (typeof reference === "string" && /^[a-f0-9-]{36}$/.test(reference)) this.reference=reference;
  }
}
export function createAccountClient(fetcher = fetch) {
  let csrfToken = null, userId = null, epoch = 0;
  const queues = new Map();
  const request = (path,input,{queueKey="account"} = {}) => {
    const requestedEpoch = epoch;
    const run = async () => {
      if (input !== undefined && !path.startsWith("/api/auth/") && requestedEpoch !== epoch) throw new AccountError("sessionExpired",401);
      let response;
      try {
        response = await fetcher(path,{method:input === undefined ? "GET" : "POST",credentials:"same-origin",cache:"no-store",
          headers:input === undefined ? {} : {"Content-Type":"application/json",...(csrfToken ? {"X-CSRF-Token":csrfToken} : {})},
          ...(input === undefined ? {} : {body:JSON.stringify(input)})});
      } catch { throw new AccountError("connectionError"); }
      let data;
      try { data = await response.json(); } catch { throw new AccountError("connectionError",response.status); }
      if (!response.ok) throw new AccountError(data.error || "connectionError",response.status,data.reference);
      const state = data.state || data;
      if (state.user !== undefined) {
        if (userId !== (state.user?.id || null)) epoch++;
        userId = state.user?.id || null;
        csrfToken = state.user ? state.csrfToken : null;
      }
      return data;
    };
    const result = (queues.get(queueKey) || Promise.resolve()).then(run);
    const tail = result.catch(()=>{}); queues.set(queueKey,tail);
    tail.then(()=>{if(queues.get(queueKey)===tail)queues.delete(queueKey)});
    return result;
  };
  return {request};
}
