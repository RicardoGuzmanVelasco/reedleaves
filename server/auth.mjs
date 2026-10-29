import {randomBytes, randomUUID, scrypt, timingSafeEqual, createHash} from "node:crypto";
import {promisify} from "node:util";
import {isPostgres,transaction} from "./database.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";
import {ApiError} from "./errors.mjs";
import {INVITE_CODE_MIN_LENGTH, LANGUAGES, defaultCardLanguages, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH} from "../app/core.mjs";

const derive = promisify(scrypt);
const parameters = {N:131072,r:8,p:1,maxmem:256 * 1024 * 1024};
export const SESSION_SECONDS = 7 * 86400;
export const COOKIE_NAME = "reedleaves_session";

export function requireProductionInviteCode(value) {
  if (typeof value !== "string" || value.length < INVITE_CODE_MIN_LENGTH) throw new Error(`Production requires a REED_INVITE_CODE of at least ${INVITE_CODE_MIN_LENGTH} characters`);
  return value;
}

const digest = value => createHash("sha256").update(value).digest("hex");
const usernameOf = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const usernamePattern = new RegExp(`^[a-z0-9][a-z0-9._-]{${USERNAME_MIN_LENGTH - 1},${USERNAME_MAX_LENGTH - 1}}$`);
const validUsername = value => usernamePattern.test(value);
const validPassword = value => typeof value === "string" && [...value].length >= PASSWORD_MIN_LENGTH && [...value].length <= PASSWORD_MAX_LENGTH && Buffer.byteLength(value) <= 512;
let activeHashes = 0;
async function hash(password,salt) {
  if (activeHashes >= 2) throw new ApiError(429,"tryLater");
  activeHashes++;
  try { return await derive(password,salt,64,parameters); }
  finally { activeHashes--; }
}
export function serverDay(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value = type => parts.find(p=>p.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function validZone(value) {
  try { return typeof value === "string" && value.length <= 64 && new Intl.DateTimeFormat("en",{timeZone:value}).resolvedOptions().timeZone; }
  catch { return false; }
}
export function sessionCookie(token, secure = false, clear = false) {
  return `${COOKIE_NAME}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}
function tokenFrom(request) {
  const tokens = (request.headers.cookie || "").split(";").map(v=>v.trim()).filter(v=>v.startsWith(COOKIE_NAME+"="));
  if (tokens.length !== 1) return null;
  const token = tokens[0].slice(COOKIE_NAME.length+1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function readSession(db,request,now = new Date()) {
  const token = tokenFrom(request);
  if (!token) return null;
  return await db.prepare(`SELECT s.token_hash,s.csrf_token,s.expires_at,a.user_id,a.username,a.time_zone,a.language
    FROM sessions s JOIN accounts a ON a.user_id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(digest(token),Math.floor(now.getTime()/1000)) || null;
}
export function checkCsrf(session,token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token),Buffer.from(session.csrf_token))) throw new ApiError(403,"invalidRequest");
}
export async function revokeSession(db,session) {
  if (session) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(session.token_hash);
}
async function issueSession(db,userId,now,previous) {
  await revokeSession(db,previous);
  const token = randomBytes(32).toString("hex"), csrf = randomBytes(32).toString("hex"), seconds = Math.floor(now.getTime()/1000);
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(seconds);
  await db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(digest(token),userId,csrf,seconds+SESSION_SECONDS);
  return token;
}
export async function rateLimit(db,bucket,now,max = 10) {
  const seconds = Math.floor(now.getTime()/1000), key = digest(bucket);
  await transaction(db,async()=>{
    await db.prepare("DELETE FROM auth_limits WHERE resets_at <= ?").run(seconds);
    const row = await db.prepare("SELECT attempts FROM auth_limits WHERE bucket = ?").get(key);
    if (row?.attempts >= max) throw new ApiError(429,"tryLater");
    await db.prepare("INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=auth_limits.attempts+1").run(key,seconds+900);
  });
}
export async function authenticate(db,kind,input,{now = new Date(),ip = "unknown",previous = null,inviteCode} = {}) {
  const username = usernameOf(input.username);
  await rateLimit(db,"ip:"+ip,now,30);
  await rateLimit(db,"name:"+username,now,10);
  if (kind === "register" && inviteCode !== undefined) {
    const supplied = createHash("sha256").update(typeof input.inviteCode === "string" ? input.inviteCode : "").digest();
    const expected = createHash("sha256").update(inviteCode).digest();
    if (!timingSafeEqual(supplied,expected)) throw new ApiError(403,"invalidInvitation");
  }
  if (!validUsername(username) || !validPassword(input.password)) throw new ApiError(400,"invalidCredentials");
  if (kind === "register") {
    const timeZone = validZone(input.timeZone || "Europe/Madrid"), language = input.language || "es";
    if (!timeZone || !LANGUAGES.includes(language)) throw new ApiError(400,"invalidRequest");
    const salt = randomBytes(16).toString("hex"), result = await hash(input.password,salt);
    return transaction(db,async()=>{
      if (await db.prepare("SELECT 1 FROM accounts WHERE username = ?").get(username)) throw new ApiError(409,"usernameTaken");
      const userId = randomUUID();
      await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(userId,username);
      await db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?)").run(userId,username,`scrypt$131072$8$1$${salt}$${result.toString("hex")}`,timeZone,language);
      await db.prepare("INSERT INTO reader_language_preferences(user_id,languages,configured,revision) VALUES (?,?,?,0)")
        .run(userId,JSON.stringify(defaultCardLanguages(language)),isPostgres(db)?false:0);
      await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run(userId,10,dailyCycleDay(timeZone,now,DAILY_CYCLE_STARTS.currencyRefill));
      return issueSession(db,userId,now,previous);
    });
  }
  const account = await db.prepare("SELECT * FROM accounts WHERE username = ?").get(username);
  // Unknown accounts still pay the same hashing cost; no password/user enumeration.
  const saved = account?.password_hash.split("$");
  const result = await hash(input.password,saved?.[4] || "00000000000000000000000000000000");
  if (!account || !timingSafeEqual(result,Buffer.from(saved[5],"hex"))) throw new ApiError(401,"invalidCredentials");
  return transaction(db,()=>issueSession(db,account.user_id,now,previous));
}
