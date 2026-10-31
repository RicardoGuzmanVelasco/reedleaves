import {randomUUID} from "node:crypto";
import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {LANGUAGES,READING_GUIDE_MAX_LENGTH} from "../app/core.mjs";

const deckIdFor=bookId=>`reading-guides:${bookId}`;

export async function submitReadingGuide(db,session,input={}) {
  const bookId=input.bookId,language=input.language,body=typeof input.body==="string"?input.body.trim():"";
  if(typeof bookId!=="string"||!bookId.trim()||bookId.length>240||!LANGUAGES.includes(language)||!body||body.length>READING_GUIDE_MAX_LENGTH) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if(!await db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)) throw new ApiError(404,"bookUnavailable");
    const reading=await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(session.user_id,bookId);
    const id=deckIdFor(bookId);
    let deck=await db.prepare("SELECT * FROM decks WHERE id=?").get(id);
    if(!deck) {
      if(reading?.status!=="read") throw new ApiError(409,"bookMustBeRead");
      await db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,status,kind,contribution_policy,max_cards_per_contributor)
        VALUES (?,?,'reed-team','en','published','collective','open',1) ON CONFLICT(id) DO NOTHING`).run(id,bookId);
    }
    deck=await db.prepare(`SELECT * FROM decks WHERE id=?${isPostgres(db)?" FOR UPDATE":""}`).get(id);
    if(!deck||deck.book_id!==bookId||deck.kind!=="collective"||deck.contribution_policy!=="open"||deck.max_cards_per_contributor!==1) throw new ApiError(409,"readingGuidesUnavailable");
    const owned=await db.prepare("SELECT id,language FROM cards WHERE deck_id=? AND creator_user_id=? AND is_reading_guide=1").get(id,session.user_id);
    if(owned) {
      if(input.cardId!==owned.id) throw new ApiError(409,"readingGuideAlreadyAdded");
      if(owned.language!==language) throw new ApiError(409,"readingGuideLanguageLocked");
      await db.prepare("UPDATE card_translations SET title=?,body=? WHERE card_id=? AND language=?")
        .run(body.slice(0,72),body,owned.id,language);
      return {deckId:id,cardId:owned.id,updated:true};
    }
    if(input.cardId!==undefined) throw new ApiError(404,"readingGuideUnavailable");
    if(reading?.status!=="read") throw new ApiError(409,"bookMustBeRead");
    const cardId=randomUUID(),position=Number((await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM cards WHERE deck_id=?").get(id)).position);
    await db.prepare(`INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,is_reading_guide,creator_user_id,language,created_at)
      VALUES (?,?,?,NULL,?,0,1,?,?,?)`).run(cardId,id,bookId,position,session.user_id,language,new Date().toISOString());
    await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
      .run(cardId,language,body.slice(0,72),body);
    for(const [tag,title,description] of [["es","Guías de lectura","Guías de lectura de la comunidad"],["en","Reading guides","Community reading guides"]]) {
      await db.prepare(`INSERT INTO deck_translations(deck_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)
        ON CONFLICT(deck_id,language) DO NOTHING`).run(id,tag,title,description,title);
    }
    return {deckId:id,cardId,updated:false};
  });
}
