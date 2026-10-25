export function usefulProfileReturnHash(hash) {
  const route=typeof hash==="string" ? hash.match(/^#([^/?]+)/)?.[1] : "";
  return !!route&&!new Set(["home","account","profile"]).has(route);
}

export function profileReturnTarget(hash) {
  return usefulProfileReturnHash(hash) ? hash : "#home";
}
