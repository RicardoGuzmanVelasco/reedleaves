import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";

async function accessibleCard(db,session,cardId) {
  if (typeof cardId !== "string" || !cardId.trim() || cardId.length > 240) throw new ApiError(400,"invalidRequest");
  const card=await db.prepare(`SELECT c.id,d.creator_user_id FROM cards c
    JOIN decks d ON d.id=c.deck_id WHERE c.id=?`).get(cardId);
  if (!card) throw new ApiError(404,"cardUnavailable");
  return card;
}

async function cardVoteState(db,session,card) {
  const likes=Number((await db.prepare("SELECT count(*) AS n FROM card_votes WHERE card_id=? AND value=1").get(card.id)).n);
  const dislikes=Number((await db.prepare("SELECT count(*) AS n FROM card_votes WHERE card_id=? AND value=-1").get(card.id)).n);
  const current=session ? await db.prepare("SELECT value FROM card_votes WHERE user_id=? AND card_id=?").get(session.user_id,card.id) : null;
  return {cardId:card.id,likes,dislikes,vote:current?.value ?? null,isOwn:!!session && card.creator_user_id === session.user_id};
}

export async function readCardVotes(db,session,cardId) {
  return transaction(db,async()=>cardVoteState(db,session,await accessibleCard(db,session,cardId)));
}

export async function setCardVote(db,session,{cardId,value} = {}) {
  if (![ -1,0,1 ].includes(value)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const card=await accessibleCard(db,session,cardId);
    if (card.creator_user_id === session.user_id) throw new ApiError(409,"ownCardVote");
    if (value === 0) await db.prepare("DELETE FROM card_votes WHERE user_id=? AND card_id=?").run(session.user_id,card.id);
    else await db.prepare(`INSERT INTO card_votes(user_id,card_id,value) VALUES (?,?,?)
      ON CONFLICT(user_id,card_id) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(session.user_id,card.id,value);
    return cardVoteState(db,session,card);
  });
}
