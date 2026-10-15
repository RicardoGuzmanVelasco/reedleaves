// A missing provider double must fail locally, before spending API credit.
export function localFetch(fetcher) {
  return async function(input,options) {
    const url=new URL(input instanceof Request ? input.url : input);
    const local=url.protocol === "http:" && ["127.0.0.1","localhost","[::1]"].includes(url.hostname);
    if (!local && url.protocol !== "data:") throw new Error("External fetch blocked in tests. Inject a simulated provider.");
    return fetcher(input,options);
  };
}

globalThis.fetch=localFetch(globalThis.fetch);
