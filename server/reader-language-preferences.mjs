import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {CONTENT_LANGUAGES,defaultCardLanguages,normalizeLanguageList} from "../app/core.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";

function decode(row,accountLanguage) {
  let languages;
  try { languages=JSON.parse(row.languages); } catch {}
  return {languages:normalizeLanguageList(languages,defaultCardLanguages(accountLanguage)),
    configured:!!row.configured,revision:Number(row.revision)};
}

async function ensureRow(db,userId) {
  const account=await db.prepare("SELECT language FROM accounts WHERE user_id=?").get(userId);
  if(!account) throw new ApiError(401,"signInRequired");
  let row=await db.prepare("SELECT languages,configured,revision FROM reader_language_preferences WHERE user_id=?").get(userId);
  if(!row) {
    const languages=defaultCardLanguages(account.language);
    await db.prepare("INSERT INTO reader_language_preferences(user_id,languages,configured,revision) VALUES (?,?,?,0) ON CONFLICT(user_id) DO NOTHING").run(userId,JSON.stringify(languages),isPostgres(db)?false:0);
    row=await db.prepare("SELECT languages,configured,revision FROM reader_language_preferences WHERE user_id=?").get(userId);
  }
  return {accountLanguage:account.language,...decode(row,account.language)};
}

export async function readerLanguagePreferencesInside(db,userId) {
  return ensureRow(db,userId);
}

// Decision: card-language options are fixed to the supported content languages.
// Deriving them from every practiceable deck and card scanned the whole catalog on each
// own-profile load. Revisit if content in other locales is introduced.
function availableLanguages() {
  return CONTENT_LANGUAGES;
}

export async function readReaderLanguagePreferences(db,session) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  return transaction(db,async()=>{await lockReaderAccount(db,session.user_id);return withOptions(db,session.user_id,await ensureRow(db,session.user_id));});
}

async function withOptions(db,userId,state) {
  return {...state,options:normalizeLanguageList([...availableLanguages(),...state.languages,...defaultCardLanguages(state.accountLanguage)],[])};
}

export async function saveReaderLanguagePreferences(db,session,input) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  if(!input||!Array.isArray(input.languages)||input.languages.length<1||input.languages.length>200||
      input.languages.some(language=>typeof language!=="string")||!Number.isSafeInteger(input.revision)||input.revision<0) throw new ApiError(400,"invalidRequest");
  const languages=normalizeLanguageList(input.languages,[]);
  if(!languages.length||languages.length!==new Set(input.languages).size||languages.length!==input.languages.length) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    await lockReaderAccount(db,session.user_id);
    const current=await ensureRow(db,session.user_id);
    if(input.revision!==current.revision) return {conflict:true,current:await withOptions(db,session.user_id,current)};
    const revision=current.revision+1;
    await db.prepare("UPDATE reader_language_preferences SET languages=?,configured=?,revision=? WHERE user_id=?")
      .run(JSON.stringify(languages),isPostgres(db)?true:1,revision,session.user_id);
    return withOptions(db,session.user_id,{...current,languages,configured:true,revision});
  });
}
