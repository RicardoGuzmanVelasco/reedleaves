import { openDatabase, initializeDatabase } from "./database.mjs";
import { seedCatalog } from "./seed.mjs";
import { checkCatalog } from "./catalog-repository.mjs";
import { createCatalogServer } from "./http.mjs";
import { APP_NAME } from "../app/brand.mjs";

const production = process.env.NODE_ENV === "production";
if (production && !process.env.DATABASE_URL) throw new Error("Production requires DATABASE_URL (PostgreSQL)");
const db = openDatabase();
await initializeDatabase(db);
if ((await db.prepare("SELECT count(*) AS total FROM books").get()).total === 0) await seedCatalog(db);
const counts = await checkCatalog(db);
const origin = process.env.REED_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (production && (!origin?.startsWith("https://"))) throw new Error("Production requires an HTTPS public origin");
const inviteCode = process.env.REED_INVITE_CODE;
if (production && (!inviteCode || inviteCode.length < 24)) throw new Error("Production requires a REED_INVITE_CODE of at least 24 characters");
const server = createCatalogServer(db,undefined,{origin,secureCookies:production || origin?.startsWith("https://"),inviteCode});
const port = Number(process.env.REED_PORT || process.env.PORT || 4173);
const host = process.env.REED_HOST || (production ? "0.0.0.0" : "127.0.0.1");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid REED_PORT");
server.on("error", async error => { console.error(error.message); await db.close(); process.exitCode = 1; });
server.listen(port, host, () => console.log(`${APP_NAME}: http://${host}:${port}/app/ · ${counts.books} books · ${counts.cards} cards`));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  server.close(async () => { await db.close(); process.exit(0); });
  server.closeIdleConnections();
});
