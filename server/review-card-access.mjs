// Keep review-card visibility aligned across the Repasar selector and the
// available card-language list. Draft collective access follows the same
// owner, open, and selected-invitation rules as deck reading.
export function canReviewDeck(deck,userId,{preserveArchivedSession=false}={}) {
  if(!deck||deck.hasReadingGuide) return false;
  if(deck.status==="archived"&&!deck.enrolled&&!preserveArchivedSession) return false;
  const owner=deck.creatorUserId===userId;
  const invited=deck.kind==="collective"&&deck.contributionPolicy==="selected"&&deck.invited;
  const open=deck.kind==="collective"&&deck.contributionPolicy==="open";
  if(deck.status==="draft"&&deck.kind==="collective"&&!owner&&!invited&&!open) return false;
  return true;
}

export async function reviewableDeckIds(db,userId) {
  if(!userId) return new Set();
  const rows=await db.prepare(`SELECT d.id,d.status,d.kind,d.contribution_policy,d.creator_user_id,
      EXISTS(SELECT 1 FROM studies s WHERE s.user_id=? AND s.deck_id=d.id) AS enrolled,
      EXISTS(SELECT 1 FROM deck_contributors dc WHERE dc.user_id=? AND dc.deck_id=d.id) AS invited,
      EXISTS(SELECT 1 FROM cards c WHERE c.deck_id=d.id AND c.is_reading_guide=1) AS has_reading_guide
    FROM decks d`).all(userId,userId);
  return new Set(rows.filter(row=>canReviewDeck({status:row.status,kind:row.kind,
    contributionPolicy:row.contribution_policy,creatorUserId:row.creator_user_id,
    enrolled:!!row.enrolled,invited:!!row.invited,hasReadingGuide:!!row.has_reading_guide},userId)).map(row=>row.id));
}
