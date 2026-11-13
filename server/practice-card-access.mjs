// Practice-card visibility is shared by the Repasar selector and the available
// card-language list. Reading is open to everyone, whatever the deck's
// contribution policy: only reading-guide decks are left out.
export async function practiceDeckIds(db,userId) {
  if(!userId) return new Set();
  const rows=await db.prepare(`SELECT d.id FROM decks d
    WHERE NOT EXISTS(SELECT 1 FROM cards c WHERE c.deck_id=d.id AND c.is_reading_guide=1)`).all();
  return new Set(rows.map(row=>row.id));
}
