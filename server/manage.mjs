import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, initializeDatabase, backupDatabase, DEFAULT_DB } from "./database.mjs";
import { seedCatalog } from "./seed.mjs";
import { checkCatalog } from "./catalog-repository.mjs";
import { setLeafBalance } from "./leaf-wallet-repository.mjs";

const action = process.argv[2];
if (!["init", "seed", "check", "backup", "leaves"].includes(action)) throw new Error("Use init, seed, check, backup <destination> or leaves <username> <balance>");
if (action === "leaves" && (process.argv.length !== 5 || !process.argv[3].trim() || !/^\d+$/.test(process.argv[4]) || !Number.isSafeInteger(Number(process.argv[4])))) {
  throw new Error("Uso: npm run db:leaves -- <usuario> <saldo entero no negativo>");
}
const db = openDatabase();
try {
  await initializeDatabase(db);
  if (action === "seed") console.log(await seedCatalog(db));
  else if (action === "check") console.log(await checkCatalog(db));
  else if (action === "leaves") console.log(await setLeafBalance(db,process.argv[3],Number(process.argv[4])));
  else if (action === "backup") {
    const destination = process.argv[3];
    if (!destination || resolve(destination) === resolve(process.env.REED_DB_PATH || DEFAULT_DB) || existsSync(destination)) throw new Error("Choose a new backup file; existing files are never overwritten");
    await backupDatabase(db, destination);
    console.log(`Backup saved: ${resolve(destination)}`);
  } else console.log("Schema initialized");
} finally { await db.close(); }
