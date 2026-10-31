export function toggleProfileInterest(state,interestId,target,limit=5) {
  if (!state || !["interested","notInterested"].includes(target)) return {state,changed:false,reason:"invalid"};
  const other=target === "interested" ? "notInterested" : "interested";
  const current=state[target]||[],opposite=state[other]||[];
  if (current.includes(interestId)) return {state:{...state,[target]:current.filter(id=>id!==interestId)},changed:true};
  if (current.length>=limit) return {state,changed:false,reason:"limit"};
  return {state:{...state,[target]:[...current,interestId],[other]:opposite.filter(id=>id!==interestId)},changed:true,moved:opposite.includes(interestId)};
}
