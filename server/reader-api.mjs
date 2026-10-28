import {randomUUID} from "node:crypto";
import {authenticate, readSession, revokeSession, checkCsrf, sessionCookie} from "./auth.mjs";
import {readProfile,recordCardView} from "./profile-repository.mjs";
import {ApiError} from "./errors.mjs";
import {readReaderState, selectDeck, addDeckToCollection, removeDeckFromCollection, openCard, changeReading, changePreferences, dailyIdea, dailyIdeaStatus, savePracticeAnswer} from "./reader-repository.mjs";
import {startPracticeSession,answerPracticeSession} from "./practice-economy.mjs";

import {createBook,createDeck,addDeckContributors,changeDeckLanguage,changeDeckTitle,addCard,takeFirstNote,finishDeck,finishNoteDecks,completeBook,ownedBookInformation,mergeOwnedBookMetadata} from "./author-repository.mjs";
import {createBookAutofill} from "./book-autofill.mjs";
import {MAX_BOOK_INTERESTS} from "../app/book-interests.mjs";
import {readCardVotes,setCardVote} from "./card-votes.mjs";
import {readCardActions,readSavedCards,setCardSave} from "./card-saves.mjs";
import {FEEDBACK_MESSAGE_MAX_LENGTH,FEEDBACK_PAGE_MAX_LENGTH} from "../app/core.mjs";
import {submitReadingGuide} from "./reading-guides.mjs";
import {readReaderInterestPreferences,saveReaderInterestPreferences} from "./reader-interest-preferences.mjs";

async function readBody(request,maxBytes = 8192) {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") throw new ApiError(415,"invalidRequest");
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new ApiError(413,"invalidRequest");
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
export function createReaderApi(db,{now = ()=>new Date(),origin,secureCookies = false,inviteCode,bookAutofill=createBookAutofill()} = {}) {
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || !["https:","http:"].includes(url.protocol) || url.protocol === "https:" && !secureCookies) throw new Error("Invalid API origin/cookie configuration");
  }
  return async (request,response,path,send) => {
    const routes = new Map([["/api/session",["GET","HEAD"]],["/api/auth/register",["POST"]],["/api/auth/login",["POST"]],
      ["/api/auth/logout",["POST"]],["/api/reader/state",["GET","HEAD"]],["/api/reader/select",["POST"]],["/api/reader/collect",["POST"]],["/api/reader/remove",["POST"]],
      ["/api/reader/open",["POST"]],["/api/reader/reading",["POST"]],["/api/reader/practice-answer",["POST"]],["/api/reader/practice/start",["POST"]],["/api/reader/practice/answer",["POST"]],["/api/reader/preferences",["POST"]],["/api/reader/interests/preferences",["GET","HEAD","POST"]],["/api/reader/daily",["POST"]],["/api/reader/daily-status",["GET"]],["/api/author/books",["POST"]],["/api/author/books/autofill",["POST"]],["/api/author/books/complete",["POST"]],["/api/author/decks",["POST"]],["/api/author/decks/finish",["POST"]],["/api/author/cards",["POST"]]]);
    routes.set("/api/reader/guides",["POST"]);
    routes.set("/api/feedback",["POST"]);
    routes.set("/api/author/decks/finish-notes",["POST"]);
    routes.set("/api/author/decks/contributors",["POST"]);
    routes.set("/api/author/decks/language",["POST"]);
    routes.set("/api/author/decks/title",["POST"]);
    routes.set("/api/author/notes",["POST"]);
    const profileMatch=path.match(/^\/api\/profiles\/([^/]+)$/);
    const cardVotesMatch=path.match(/^\/api\/cards\/([^/]+)\/votes$/);
    const cardActionsMatch=path.match(/^\/api\/cards\/([^/]+)\/actions$/);
    const savedCardsMatch=path.match(/^\/api\/reader\/saved\/([^/]+)$/);
    if (profileMatch) routes.set(path,["GET","HEAD"]);
    if (cardVotesMatch) routes.set(path,["GET","HEAD"]);
    if (cardActionsMatch || savedCardsMatch) routes.set(path,["GET","HEAD"]);
    routes.set("/api/cards/vote",["POST"]);
    routes.set("/api/cards/save",["POST"]);
    routes.set("/api/reader/view",["POST"]);
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
      if (cardVotesMatch && request.method !== "POST") { send(200,await readCardVotes(db,session,decodeURIComponent(cardVotesMatch[1]))); return true; }
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
      if (profileMatch) { send(200,await readProfile(db,profileMatch[1],session.user_id)); return true; }
      if (path === "/api/reader/interests/preferences" && ["GET","HEAD"].includes(request.method)) {
        send(200,await readReaderInterestPreferences(db,session)); return true;
      }
      if (path === "/api/reader/daily-status") { send(200,await dailyIdeaStatus(db,session,time)); return true; }
      if (cardVotesMatch) { send(200,await readCardVotes(db,session,decodeURIComponent(cardVotesMatch[1]))); return true; }
      if (cardActionsMatch) { send(200,await readCardActions(db,session,decodeURIComponent(cardActionsMatch[1]))); return true; }
      if (savedCardsMatch) { send(200,await readSavedCards(db,session,decodeURIComponent(savedCardsMatch[1]))); return true; }
      if (request.method === "POST") checkCsrf(session,request.headers["x-csrf-token"]);
      if (path === "/api/auth/logout") {
        await readBody(request); await revokeSession(db,session);
        response.setHeader("Set-Cookie",sessionCookie("",secureCookies,true)); send(200,inviteCode === undefined ? {user:null} : {user:null,inviteRequired:true}); return true;
      }
      if (path === "/api/reader/state") { send(200,await readReaderState(db,session,time)); return true; }
      const input = await readBody(request,path === "/api/feedback" ? 24576 : path.startsWith("/api/author/books") ? 65536 : path.startsWith("/api/author/") ? 32768 : 8192);
      // Re-check after awaiting the body: a concurrent logout/expiry must revoke writes.
      const active = await readSession(db,request,now());
      if (!active) throw new ApiError(401,"signInRequired");
      checkCsrf(active,request.headers["x-csrf-token"]);
      const currentTime = now();
      if (path === "/api/reader/practice-answer") { send(200,await savePracticeAnswer(db,active,input,currentTime)); return true; }
      if (path === "/api/reader/practice/start") {
        const result=await startPracticeSession(db,active,input.topic,currentTime,Object.hasOwn(input,"sessionId")?input.sessionId:undefined);
        send(200,{...result,state:await readReaderState(db,active,currentTime)}); return true;
      }
      if (path === "/api/reader/practice/answer") {
        const result=await answerPracticeSession(db,active,input,currentTime);
        send(200,{...result,state:await readReaderState(db,active,currentTime)}); return true;
      }
      if (path === "/api/reader/interests/preferences") {
        const result=await saveReaderInterestPreferences(db,active,input,currentTime);
        if (result.conflict) send(409,{error:"preferencesConflict",current:result.current});
        else send(200,result);
        return true;
      }
      if (path === "/api/feedback") {
        const message=typeof input.message === "string" ? input.message.trim() : "",page=input.page;
        if (!message || message.length > FEEDBACK_MESSAGE_MAX_LENGTH || typeof page !== "string" || !/^\/[A-Za-z0-9/_%.-]*(?:#[A-Za-z0-9/_%.-]*)?$/.test(page) || page.length > FEEDBACK_PAGE_MAX_LENGTH || !["es","en"].includes(input.language)) throw new ApiError(400,"invalidFeedback");
        const account=await db.prepare("SELECT username FROM accounts WHERE user_id=?").get(active.user_id);
        if (!account) throw new ApiError(401,"signInRequired");
        const id=randomUUID();
        await db.prepare("INSERT INTO feedback_submissions(id,user_id,username,message,page,language) VALUES (?,?,?,?,?,?)")
          .run(id,active.user_id,account.username,message,page,input.language);
        send(200,{saved:true,id}); return true;
      }
      if (path === "/api/reader/view") { send(200,await recordCardView(db,active,input,currentTime)); return true; }
      if (path === "/api/reader/guides") { const result=await submitReadingGuide(db,active,input); send(200,{...result,state:await readReaderState(db,active,currentTime)}); return true; }
      if (path === "/api/cards/vote") { send(200,await setCardVote(db,active,input)); return true; }
      if (path === "/api/cards/save") { send(200,await setCardSave(db,active,input,currentTime)); return true; }
      if (path === "/api/author/books/autofill") {
        let search=input;
        if (input.bookId !== undefined) {
          const existing=await ownedBookInformation(db,active,input.bookId);
          try { search={...existing,metadata:input.metadata ? mergeOwnedBookMetadata(existing,input.metadata) : existing.metadata}; }
          catch { throw new ApiError(400,"invalidRequest"); }
          // A historical list is immutable here. Generate missing text under the
          // current proposal contract, then restore the stored associations below.
          if (search.metadata.genres.length>MAX_BOOK_INTERESTS) search.metadata={...search.metadata,genres:[]};
        }
        const genres=await db.prepare("SELECT g.id,t.name FROM genres g JOIN genre_translations t ON t.genre_id=g.id WHERE t.language='en' ORDER BY g.id").all();
        const preview=await bookAutofill(active.user_id,search,genres);
        // Search can outlive a session: don't return private drafts after logout.
        const stillActive=await readSession(db,request,now());
        if (!stillActive) throw new ApiError(401,"signInRequired");
        checkCsrf(stillActive,request.headers["x-csrf-token"]);
        if (input.bookId !== undefined) {
          const latest=await ownedBookInformation(db,stillActive,input.bookId);
          preview.author=latest.author;
          try { preview.metadata=mergeOwnedBookMetadata(latest,preview.metadata); }
          catch { throw new ApiError(502,"aiError"); }
        }
        send(200,preview); return true;
      }
      if (path.startsWith("/api/author/")) {
        if (["/api/author/decks/language","/api/author/decks/title"].includes(path)) {
          const result=await (path.endsWith("title") ? changeDeckTitle : changeDeckLanguage)(db,active,input);
          send(200,{...result,state:await readReaderState(db,active,currentTime)}); return true;
        }
        const result = path === "/api/author/notes" ? await takeFirstNote(db,active,input) : path === "/api/author/decks/finish-notes" ? await finishNoteDecks(db,active,input) : path === "/api/author/decks/contributors" ? await addDeckContributors(db,active,input) : path === "/api/author/decks/finish" ? await finishDeck(db,active,input) : path.endsWith("complete") ? await completeBook(db,active,input) : path.endsWith("books") ? await createBook(db,active,input) : path.endsWith("decks") ? await createDeck(db,active,input) : await addCard(db,active,input);
        send(200,{...result,state:await readReaderState(db,active,currentTime)}); return true;
      }
      const result = path === "/api/reader/collect" ? await addDeckToCollection(db,active,input.deckId,currentTime) :
        path === "/api/reader/remove" ? await removeDeckFromCollection(db,active,input.deckId,currentTime) :
        path === "/api/reader/select" ? await selectDeck(db,active,input.deckId,currentTime,{requireCollection:true}) :
        path === "/api/reader/open" ? await openCard(db,active,input.deckId,input.cardId,currentTime,{requireCollection:true}) :
        path === "/api/reader/reading" ? await changeReading(db,active,input.bookId,input.status,currentTime) :
        path === "/api/reader/preferences" ? await changePreferences(db,active,input,currentTime) : await dailyIdea(db,active,currentTime);
      send(200,result);
    } catch(error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 429) response.setHeader("Retry-After","900");
      send(error.status,{error:error.code,...(error.reference ? {reference:error.reference} : {})});
    }
    return true;
  };
}
