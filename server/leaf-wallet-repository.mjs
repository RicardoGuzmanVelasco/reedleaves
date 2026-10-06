import {transaction} from "./database.mjs";
import {restoreWallet} from "../app/wallet.mjs";

// Caller supplies the server date in the account's fixed time zone.
export function readLeafWallet(db, userId, today) {
  return transaction(db,() => accrueLeafWallet(db,userId,today));
}

// For use inside an existing transaction (state reads, daily draw, unlock).
export function accrueLeafWallet(db, userId, today) {
    const saved = db.prepare("SELECT balance,last_accrual_day AS lastAccrualDay FROM leaf_wallets WHERE user_id = ?").get(userId);
    const wallet = restoreWallet(saved,today);
    if (!restoreWallet(null,today).lastAccrualDay) throw new Error("Invalid wallet date");
    db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET balance=excluded.balance,last_accrual_day=excluded.last_accrual_day")
      .run(userId,wallet.balance,wallet.lastAccrualDay);
    return wallet;
}
