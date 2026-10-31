// A personal connection places a book in Por leer until reading starts or finishes.
export async function distinguishedBookIds(db,userId) {
  const rows=await db.prepare(`SELECT id AS book_id FROM books WHERE creator_user_id=?
    UNION SELECT book_id FROM decks WHERE creator_user_id=? AND status!='archived'
    UNION SELECT d.book_id FROM studies s JOIN decks d ON d.id=s.deck_id WHERE s.user_id=?
    UNION SELECT c.book_id FROM card_saves s JOIN cards c ON c.id=s.card_id WHERE s.user_id=?`).all(userId,userId,userId,userId);
  return rows.map(row=>row.book_id);
}
export async function ensureBookToRead(db,userId,bookId) {
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'unread') ON CONFLICT(user_id,book_id) DO NOTHING").run(userId,bookId);
}
