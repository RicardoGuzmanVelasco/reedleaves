export class AccountError extends Error {
  constructor(code,status = 0,reference) { super(code); this.code = code; this.status = status;
    if (typeof reference === "string" && /^[a-f0-9-]{36}$/.test(reference)) this.reference=reference;
  }
}
export function createAccountClient(fetcher = fetch) {
  let csrfToken = null, queue = Promise.resolve();
  const request = (path,input) => {
    const run = async () => {
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
      if (state.user !== undefined) csrfToken = state.user ? state.csrfToken : null;
      return data;
    };
    const result = queue.then(run); queue = result.catch(()=>{}); return result;
  };
  return {request};
}
