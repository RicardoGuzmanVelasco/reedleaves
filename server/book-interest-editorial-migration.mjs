// Editorial order audited for the current multi-interest catalog. Each entry
// also records the complete association set expected before positions move.
export const EDITORIAL_BOOK_INTERESTS = Object.freeze({
  "seven-habits": ["personal-growth", "productivity"],
  "atomic-habits": ["personal-growth", "productivity"],
  "same-as-ever": ["personal-growth", "finance"],
  "f7eef033-9cb9-4178-866d-400559cf4ad6": ["personal-growth", "productivity"],
  "e7187e5d-d130-4f6c-b5d3-5143d8b848a4": ["finance", "personal-growth", "productivity"],
  "f7ef39c1-0b69-4f08-8f24-c629233822e7": ["finance", "personal-growth"],
  "68cff48f-0222-415b-a78e-297eb3e9d946": ["finance", "productivity", "personal-growth"],
  "ad2004c1-9e54-42b6-b013-bc252071605c": ["finance", "personal-growth"],
  "c5887284-096c-47d7-82e6-16ce684a2bd0": ["metaphysics", "personal-growth"],
  "fearless-salary-negotiation": ["finance", "personal-growth"],
  "invierte-en-ti": ["finance", "personal-growth"],
  "2a3f6545-0198-43ac-827d-8d8d9348953e": ["personal-growth", "society", "productivity"],
  "bc164b85-a7ec-44d2-bd2c-04b073100a6c": ["personal-growth", "society", "productivity"],
});

function validateAssociations(bookId, current, expected) {
  const actual = current.map(row => row.genre_id).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((id, index) => id !== wanted[index])) {
    throw new Error(`Book interest associations changed for ${bookId}: expected ${wanted.join(",")}; found ${actual.join(",")}`);
  }
}

export function reorderEditorialBookInterestsSqlite(db) {
  for (const [bookId, ordered] of Object.entries(EDITORIAL_BOOK_INTERESTS)) {
    if (!db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)) continue;
    const rows = db.prepare("SELECT genre_id,position FROM book_genres WHERE book_id=? ORDER BY position").all(bookId);
    validateAssociations(bookId, rows, ordered);
    const temporaryStart = Math.max(...rows.map(row => row.position), 0) + 1;
    rows.forEach((row, index) => db.prepare("UPDATE book_genres SET position=? WHERE book_id=? AND genre_id=?").run(temporaryStart + index, bookId, row.genre_id));
    ordered.forEach((genreId, index) => db.prepare("UPDATE book_genres SET position=? WHERE book_id=? AND genre_id=?").run(index + 1, bookId, genreId));
  }
}

export async function reorderEditorialBookInterestsPostgres(db) {
  for (const [bookId, ordered] of Object.entries(EDITORIAL_BOOK_INTERESTS)) {
    if (!await db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)) continue;
    const rows = await db.prepare("SELECT genre_id,position FROM book_genres WHERE book_id=? ORDER BY position").all(bookId);
    validateAssociations(bookId, rows, ordered);
    const temporaryStart = Math.max(...rows.map(row => row.position), 0) + 1;
    for (const [index, row] of rows.entries()) await db.prepare("UPDATE book_genres SET position=? WHERE book_id=? AND genre_id=?").run(temporaryStart + index, bookId, row.genre_id);
    for (const [index, genreId] of ordered.entries()) await db.prepare("UPDATE book_genres SET position=? WHERE book_id=? AND genre_id=?").run(index + 1, bookId, genreId);
  }
}
