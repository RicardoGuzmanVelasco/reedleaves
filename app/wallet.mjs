export const MAX_DAILY_LEAVES = 3;

function dayNumber(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) return null;
  return date.getTime() / 86400000;
}

export function restoreWallet(saved, today) {
  const currentDay = dayNumber(today);
  const valid = Number.isSafeInteger(saved?.balance) && saved.balance >= 0 && dayNumber(saved.lastAccrualDay) !== null;
  let wallet;
  if (valid) wallet = {balance:saved.balance,lastAccrualDay:saved.lastAccrualDay};
  else {
    wallet = {balance:currentDay === null ? 0 : 1,lastAccrualDay:currentDay === null ? null : today};
  }
  const creditedDay = dayNumber(wallet.lastAccrualDay);
  if (currentDay === null || creditedDay === null || currentDay <= creditedDay) return wallet;
  return {balance:Math.max(wallet.balance,Math.min(MAX_DAILY_LEAVES,wallet.balance + currentDay - creditedDay)),lastAccrualDay:today};
}
