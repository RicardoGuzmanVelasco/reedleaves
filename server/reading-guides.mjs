import {randomUUID} from "node:crypto";
import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {LANGUAGES,READING_GUIDE_MAX_LENGTH} from "../app/core.mjs";
import {grantReaderXpInside} from "./reader-xp-repository.mjs";
import {contentVersion} from "./reader-roles.mjs";

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
      const review=await db.prepare(`SELECT status FROM reading_guide_reviews WHERE card_id=?${isPostgres(db)?" FOR UPDATE":""}`).get(owned.id);
      if(review?.status==="approved") throw new ApiError(409,"readingGuideApprovedLocked");
      await db.prepare("UPDATE card_translations SET title=?,body=? WHERE card_id=? AND language=?")
        .run(body.slice(0,72),body,owned.id,language);
      if(review?.status==="rejected") {
        await db.prepare("UPDATE reading_guide_reviews SET status='pending',submitted_at=?,reviewed_at=NULL,rejection_reason=NULL WHERE card_id=? AND status='rejected'")
          .run(new Date().toISOString(),owned.id);
      } else if(!review) {
        await db.prepare("INSERT INTO reading_guide_reviews(card_id,status) VALUES (?,'pending')").run(owned.id);
      }
      return {deckId:id,cardId:owned.id,updated:true,reviewStatus:"pending"};
    }
    if(input.cardId!==undefined) throw new ApiError(404,"readingGuideUnavailable");
    if(reading?.status!=="read") throw new ApiError(409,"bookMustBeRead");
    const cardId=randomUUID(),position=Number((await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM cards WHERE deck_id=?").get(id)).position);
    await db.prepare(`INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,is_reading_guide,creator_user_id,language,created_at)
      VALUES (?,?,?,NULL,?,0,1,?,?,?)`).run(cardId,id,bookId,position,session.user_id,language,new Date().toISOString());
    await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
      .run(cardId,language,body.slice(0,72),body);
    await db.prepare("INSERT INTO reading_guide_reviews(card_id,status,submitted_at) VALUES (?,'pending',?)")
      .run(cardId,new Date().toISOString());
    for(const [tag,title,description] of [["es","Guías de lectura","Guías de lectura de la comunidad"],["en","Reading guides","Community reading guides"]]) {
      await db.prepare(`INSERT INTO deck_translations(deck_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)
        ON CONFLICT(deck_id,language) DO NOTHING`).run(id,tag,title,description,title);
    }
    return {deckId:id,cardId,updated:false,reviewStatus:"pending"};
  });
}

export async function decideReadingGuide(db,cardId,decision,{reason,expectedContentVersion,now=new Date()}={}) {
  const rejectionReason=typeof reason==="string"?reason.trim():"";
  if(typeof cardId!=="string"||!cardId.trim()||!['approve','reject'].includes(decision)||
    expectedContentVersion!==undefined&&(typeof expectedContentVersion!=="string"||!/^[a-f0-9]{64}$/.test(expectedContentVersion))||
    decision==="reject"&&(!rejectionReason||rejectionReason.length>1000)||decision==="approve"&&reason!==undefined) {
    throw new ApiError(400,"invalidRequest");
  }
  return transaction(db,async()=>{
    const review=await db.prepare(`SELECT status FROM reading_guide_reviews WHERE card_id=?${isPostgres(db)?" FOR UPDATE":""}`).get(cardId);
    if(!review) throw new ApiError(409,"readingGuideNotPending");
    const card=await db.prepare(`SELECT c.creator_user_id,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=c.language
      WHERE c.id=? AND c.is_reading_guide=1`).get(cardId);
    if(!card?.creator_user_id) throw new ApiError(404,"readingGuideUnavailable");
    const lock=await db.prepare(`SELECT user_id FROM accounts WHERE user_id=?${isPostgres(db)?" FOR UPDATE":""}`).get(card.creator_user_id);
    if(!lock) throw new ApiError(404,"readingGuideUnavailable");
    if(expectedContentVersion!==undefined&&contentVersion(card.body)!==expectedContentVersion)throw new ApiError(409,"readingGuideChanged");
    const target=decision==="approve"?"approved":"rejected";
    if(review.status===target) return {cardId,status:target,awarded:0};
    if(review.status!=="pending") throw new ApiError(409,"readingGuideNotPending");
    const reviewedAt=now.toISOString();
    if(decision==="approve") {
      const changed=await db.prepare("UPDATE reading_guide_reviews SET status='approved',reviewed_at=?,rejection_reason=NULL WHERE card_id=? AND status='pending'")
        .run(reviewedAt,cardId);
      if(changed.changes!==1) {
        const current=await db.prepare("SELECT status FROM reading_guide_reviews WHERE card_id=?").get(cardId);
        if(current?.status==="approved") return {cardId,status:"approved",awarded:0};
        throw new ApiError(409,"readingGuideNotPending");
      }
      const reward=await grantReaderXpInside(db,card.creator_user_id,{
        eventKey:`guide_approved:${cardId}`,rewardType:"reading_guide_approved",amount:30
      });
      return {cardId,status:"approved",awarded:reward.awarded,balance:reward.balance};
    }
    const changed=await db.prepare("UPDATE reading_guide_reviews SET status='rejected',reviewed_at=?,rejection_reason=? WHERE card_id=? AND status='pending'")
      .run(reviewedAt,rejectionReason,cardId);
    if(changed.changes!==1) {
      const current=await db.prepare("SELECT status,rejection_reason FROM reading_guide_reviews WHERE card_id=?").get(cardId);
      if(current?.status==="rejected"&&current.rejection_reason===rejectionReason) return {cardId,status:"rejected",awarded:0};
      throw new ApiError(409,"readingGuideNotPending");
    }
    return {cardId,status:"rejected",awarded:0};
  });
}

export async function listPendingReadingGuides(db) {
  return db.prepare(`SELECT c.id AS "cardId",c.book_id AS "bookId",b.popular_title AS "bookTitle",
      c.creator_user_id AS "authorId",u.display_name AS "authorName",c.language,t.body,
      r.submitted_at AS "submittedAt"
    FROM reading_guide_reviews r JOIN cards c ON c.id=r.card_id
    JOIN books b ON b.id=c.book_id JOIN users u ON u.id=c.creator_user_id
    JOIN card_translations t ON t.card_id=c.id AND t.language=c.language
    WHERE r.status='pending' ORDER BY r.submitted_at,c.id`).all();
}
