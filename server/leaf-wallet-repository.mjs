import {transaction,isPostgres} from "./database.mjs";
import {restoreWallet,MAX_DAILY_LEAVES} from "../app/wallet.mjs";
import {serverDay} from "./auth.mjs";

// Administrative operation, available only through the database CLI.
// Set a total rather than add leaves so rerunning the command is safe.
export async function setLeafBalance(db, username, balance, now = new Date()) {
  if (typeof username !== "string" || !username.trim()) throw new Error("Indica un nombre de usuario");
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("El saldo debe ser un entero no negativo representable con precisión");
  return transaction(db,async() => {
    const account = await db.prepare("SELECT user_id,username,time_zone FROM accounts WHERE username = ?").get(username.trim().toLowerCase());
    if (!account) throw new Error("No existe una cuenta con ese nombre de usuario");
    const today = serverDay(account.time_zone,now);
    await db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET balance=excluded.balance,last_accrual_day=excluded.last_accrual_day")
      .run(account.user_id,balance,today);
    return {username:account.username,balance,lastAccrualDay:today};
  });
}

// Caller supplies the server date in the account's fixed time zone.
export async function readLeafWallet(db, userId, today) {
  return transaction(db,() => accrueLeafWallet(db,userId,today));
}

// For use inside an existing transaction (state reads and daily draw).
export async function accrueLeafWallet(db, userId, today) {
    if (!restoreWallet(null,today).lastAccrualDay) throw new Error("Invalid wallet date");
    const postgres = isPostgres(db), maximum = postgres ? "greatest" : "max", minimum = postgres ? "least" : "min";
    const days = postgres ? "(excluded.last_accrual_day::date - leaf_wallets.last_accrual_day::date)" :
      "CAST(julianday(excluded.last_accrual_day) - julianday(leaf_wallets.last_accrual_day) AS INTEGER)";
    // Calculate from the locked current row so a state read cannot overwrite a
    // concurrent manual adjustment or spend with a previously read balance.
    const wallet = await db.prepare(`INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES (?,1,?)
      ON CONFLICT(user_id) DO UPDATE SET
        balance=CASE WHEN excluded.last_accrual_day > leaf_wallets.last_accrual_day
          THEN ${maximum}(leaf_wallets.balance,${minimum}(${MAX_DAILY_LEAVES},leaf_wallets.balance + ${days})) ELSE leaf_wallets.balance END,
        last_accrual_day=CASE WHEN excluded.last_accrual_day > leaf_wallets.last_accrual_day
          THEN excluded.last_accrual_day ELSE leaf_wallets.last_accrual_day END
      RETURNING balance,last_accrual_day AS "lastAccrualDay"`).get(userId,today);
    return {...wallet};
}
