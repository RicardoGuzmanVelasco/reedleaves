import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, initializeDatabase, backupDatabase, DEFAULT_DB } from "./database.mjs";
import { seedCatalog } from "./seed.mjs";
import { checkCatalog } from "./catalog-repository.mjs";
import { setLeafBalance } from "./leaf-wallet-repository.mjs";
import {decideReadingGuide,listPendingReadingGuides} from "./reading-guides.mjs";

const action = process.argv[2];
if (!["init", "seed", "check", "backup", "leaves","guide-reviews","guide-review"].includes(action)) throw new Error("Use init, seed, check, backup <destination>, leaves <username> <balance>, guide-reviews, or guide-review <cardId> approve|reject [reason]");
if (action === "leaves" && (process.argv.length !== 5 || !process.argv[3].trim() || !/^\d+$/.test(process.argv[4]) || !Number.isSafeInteger(Number(process.argv[4])))) {
  throw new Error("Uso: npm run db:leaves -- <usuario> <saldo entero no negativo>");
}
if(action==="guide-reviews"&&process.argv.length!==3)throw new Error("Uso: npm run db:guide-reviews");
if(action==="guide-review"&&(process.argv.length<5||process.argv.length>6||!process.argv[3].trim()||!["approve","reject"].includes(process.argv[4])||process.argv[4]==="approve"&&process.argv.length!==5||process.argv[4]==="reject"&&(process.argv.length!==6||!process.argv[5].trim())))throw new Error("Uso: npm run db:guide-review -- <cardId> approve | <cardId> reject <motivo>");
const db = openDatabase();
try {
  await initializeDatabase(db);
  if (action === "seed") console.log(await seedCatalog(db));
  else if (action === "check") console.log(await checkCatalog(db));
  else if (action === "leaves") console.log(await setLeafBalance(db,process.argv[3],Number(process.argv[4])));
  else if(action==="guide-reviews") console.log(JSON.stringify(await listPendingReadingGuides(db),null,2));
  else if(action==="guide-review") console.log(await decideReadingGuide(db,process.argv[3],process.argv[4],process.argv[5]===undefined?{}:{reason:process.argv[5]}));
  else if (action === "backup") {
    const destination = process.argv[3];
    if (!destination || resolve(destination) === resolve(process.env.REED_DB_PATH || DEFAULT_DB) || existsSync(destination)) throw new Error("Choose a new backup file; existing files are never overwritten");
    await backupDatabase(db, destination);
    console.log(`Backup saved: ${resolve(destination)}`);
  } else console.log("Schema initialized");
} finally { await db.close(); }
