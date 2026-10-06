export const MAX_LEAVES = 3;

function dayNumber(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) return null;
  return date.getTime() / 86400000;
}

export function restoreWallet(saved, today, legacy = null) {
  const currentDay = dayNumber(today);
  const valid = Number.isInteger(saved?.balance) && saved.balance >= 0 && saved.balance <= MAX_LEAVES && dayNumber(saved.lastAccrualDay) !== null;
  let wallet;
  if (valid) wallet = {balance:saved.balance,lastAccrualDay:saved.lastAccrualDay};
  else {
    // Convert the former daily limit once, without granting a second leaf on
    // a day already spent. New users start with today's single leaf.
    const previousDay = legacy?.lastUnlockDay || saved?.lastUnlockDay;
    wallet = dayNumber(previousDay) !== null ? {balance:0,lastAccrualDay:previousDay} :
      {balance:currentDay === null ? 0 : 1,lastAccrualDay:currentDay === null ? null : today};
  }
  const creditedDay = dayNumber(wallet.lastAccrualDay);
  if (currentDay === null || creditedDay === null || currentDay <= creditedDay) return wallet;
  return {balance:Math.min(MAX_LEAVES,wallet.balance + currentDay - creditedDay),lastAccrualDay:today};
}

export function leafBalance(today, saved) {
  const wallet = restoreWallet(saved,today);
  return dayNumber(today) !== null && wallet.lastAccrualDay <= today ? wallet.balance : 0;
}

export function spendLeaf(saved, today) {
  const wallet = restoreWallet(saved,today);
  if (!leafBalance(today,wallet)) return {wallet,spent:false};
  return {wallet:{...wallet,balance:wallet.balance - 1},spent:true};
}
