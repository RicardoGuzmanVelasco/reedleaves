import {authenticate, readSession, revokeSession, checkCsrf, sessionCookie} from "./auth.mjs";
import {ApiError} from "./errors.mjs";
import {readReaderState, selectDeck, openCard, changeReading, changePreferences, dailyIdea} from "./reader-repository.mjs";

async function readBody(request) {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") throw new ApiError(415,"invalidRequest");
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new ApiError(413,"invalidRequest");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError(400,"invalidRequest"); }
}
function sameOrigin(request,origin) {
  const originHeader = request.headers.origin;
  const localPort = request.socket.localPort;
  const allowed = origin ? [origin] : [`http://127.0.0.1:${localPort}`,`http://localhost:${localPort}`];
  if (!allowed.includes(originHeader) || request.headers["sec-fetch-site"] && request.headers["sec-fetch-site"] !== "same-origin") throw new ApiError(403,"invalidRequest");
}
export function createReaderApi(db,{now = ()=>new Date(),origin,secureCookies = false,inviteCode} = {}) {
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || !["https:","http:"].includes(url.protocol) || url.protocol === "https:" && !secureCookies) throw new Error("Invalid API origin/cookie configuration");
  }
  return async (request,response,path,send) => {
    const routes = new Map([["/api/session",["GET","HEAD"]],["/api/auth/register",["POST"]],["/api/auth/login",["POST"]],
      ["/api/auth/logout",["POST"]],["/api/reader/state",["GET","HEAD"]],["/api/reader/select",["POST"]],
      ["/api/reader/open",["POST"]],["/api/reader/reading",["POST"]],["/api/reader/preferences",["POST"]],["/api/reader/daily",["POST"]]]);
    if (!routes.has(path)) return false;
    response.setHeader("Cache-Control","no-store");
    try {
      if (!routes.get(path).includes(request.method)) {
        response.setHeader("Allow",routes.get(path).join(", ")); throw new ApiError(405,"invalidRequest");
      }
      const time = now(), session = await readSession(db,request,time);
      if (path === "/api/session") {
        const state = session ? await readReaderState(db,session,time) : {user:null};
        send(200,inviteCode === undefined ? state : {...state,inviteRequired:true}); return true;
      }
      if (request.method === "POST") sameOrigin(request,origin);
      if (["/api/auth/register","/api/auth/login"].includes(path)) {
        const input = await readBody(request);
        const token = await authenticate(db,path.endsWith("register") ? "register" : "login",input,{now:time,ip:request.socket.remoteAddress,previous:session,inviteCode});
        response.setHeader("Set-Cookie",sessionCookie(token,secureCookies));
        const signed = await readSession(db,{headers:{cookie:`reedleaves_session=${token}`}},time);
        const state = await readReaderState(db,signed,time);
        send(200,inviteCode === undefined ? state : {...state,inviteRequired:true}); return true;
      }
      if (!session) throw new ApiError(401,"signInRequired");
      if (request.method === "POST") checkCsrf(session,request.headers["x-csrf-token"]);
      if (path === "/api/auth/logout") {
        await readBody(request); await revokeSession(db,session);
        response.setHeader("Set-Cookie",sessionCookie("",secureCookies,true)); send(200,inviteCode === undefined ? {user:null} : {user:null,inviteRequired:true}); return true;
      }
      if (path === "/api/reader/state") { send(200,await readReaderState(db,session,time)); return true; }
      const input = await readBody(request);
      // Re-check after awaiting the body: a concurrent logout/expiry must revoke writes.
      const active = await readSession(db,request,now());
      if (!active) throw new ApiError(401,"signInRequired");
      checkCsrf(active,request.headers["x-csrf-token"]);
      const currentTime = now();
      const result = path === "/api/reader/select" ? await selectDeck(db,active,input.versionId,currentTime) :
        path === "/api/reader/open" ? await openCard(db,active,input.versionId,input.cardId,currentTime) :
        path === "/api/reader/reading" ? await changeReading(db,active,input.bookId,input.status,currentTime) :
        path === "/api/reader/preferences" ? await changePreferences(db,active,input,currentTime) : await dailyIdea(db,active,currentTime);
      send(200,result);
    } catch(error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 429) response.setHeader("Retry-After","900");
      send(error.status,{error:error.code});
    }
    return true;
  };
}
