import {isPostgres} from "./database.mjs";

export const MAX_PETALS=15;
export const DAILY_PETAL_REFILL=9;

export async function accruePetalWallet(db,userId,today) {
  const postgres=isPostgres(db),maximum=postgres?"greatest":"max",minimum=postgres?"least":"min";
  const days=postgres?"(excluded.last_accrual_day::date-petal_wallets.last_accrual_day::date)":
    "CAST(julianday(excluded.last_accrual_day)-julianday(petal_wallets.last_accrual_day) AS INTEGER)";
  return db.prepare(`INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,0,?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance=CASE WHEN petal_wallets.last_accrual_day IS NOT NULL AND excluded.last_accrual_day>petal_wallets.last_accrual_day
        THEN ${maximum}(petal_wallets.balance,${minimum}(${MAX_PETALS},petal_wallets.balance+${DAILY_PETAL_REFILL}*${days})) ELSE petal_wallets.balance END,
      last_accrual_day=CASE WHEN petal_wallets.last_accrual_day IS NULL OR excluded.last_accrual_day>petal_wallets.last_accrual_day
        THEN excluded.last_accrual_day ELSE petal_wallets.last_accrual_day END
    RETURNING balance,last_accrual_day AS "lastAccrualDay"`).get(userId,today);
}
