// Preserve the API's pre-migration ORDER BY genre_id as a deterministic baseline.
export const BOOK_INTEREST_ORDER_SQLITE = `
  ALTER TABLE book_genres ADD COLUMN position INTEGER NOT NULL DEFAULT 1 CHECK(position > 0);
  UPDATE book_genres SET position = (
    SELECT COUNT(*) FROM book_genres earlier
    WHERE earlier.book_id=book_genres.book_id AND earlier.genre_id<=book_genres.genre_id
  );
  CREATE UNIQUE INDEX book_genres_order ON book_genres(book_id,position);
`;

export const BOOK_INTEREST_ORDER_POSTGRES = `
  ALTER TABLE book_genres ADD COLUMN position INTEGER NOT NULL DEFAULT 1 CHECK(position > 0);
  WITH ordered AS (
    SELECT book_id,genre_id,ROW_NUMBER() OVER (PARTITION BY book_id ORDER BY genre_id) AS position
    FROM book_genres
  )
  UPDATE book_genres target SET position=ordered.position
  FROM ordered WHERE target.book_id=ordered.book_id AND target.genre_id=ordered.genre_id;
  CREATE UNIQUE INDEX book_genres_order ON book_genres(book_id,position);
`;
