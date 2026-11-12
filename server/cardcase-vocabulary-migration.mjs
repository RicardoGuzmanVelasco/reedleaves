// Schema v64 (SQLite) / v56 (PostgreSQL): stored names follow the section vocabulary.
// - studies -> cardcase_decks (the decks in each reader's Cardcase).
// - deck_selections is dropped: nothing visible read the deck a reader "selected" for a book.
// - book_reading.status: the stored 'unread' ("to read", a book on the Shelf) becomes 'to_read'.
//   A book that is not read at all has no row.

export const CARDCASE_VOCABULARY_SQLITE=`
  ALTER TABLE studies RENAME TO cardcase_decks;
  DROP TABLE deck_selections;
  CREATE TABLE book_reading_new (
    user_id TEXT NOT NULL REFERENCES users(id),
    book_id TEXT NOT NULL REFERENCES books(id),
    status TEXT NOT NULL CHECK(status IN ('to_read','reading','read')),
    PRIMARY KEY(user_id,book_id)
  ) STRICT;
  INSERT INTO book_reading_new(user_id,book_id,status)
    SELECT user_id,book_id,CASE status WHEN 'unread' THEN 'to_read' ELSE status END FROM book_reading;
  DROP TABLE book_reading;
  ALTER TABLE book_reading_new RENAME TO book_reading;
`;

export const CARDCASE_VOCABULARY_POSTGRES=`
  ALTER TABLE public.book_reading DROP CONSTRAINT book_reading_status_check;
  UPDATE public.book_reading SET status='to_read' WHERE status='unread';
  ALTER TABLE public.book_reading ADD CONSTRAINT book_reading_status_check CHECK(status IN ('to_read','reading','read'));
  ALTER TABLE public.studies RENAME TO cardcase_decks;
  ALTER TABLE public.cardcase_decks RENAME CONSTRAINT studies_pkey TO cardcase_decks_pkey;
  ALTER TABLE public.cardcase_decks RENAME CONSTRAINT studies_rowid_key TO cardcase_decks_rowid_key;
  ALTER TABLE public.cardcase_decks RENAME CONSTRAINT studies_user_id_fkey TO cardcase_decks_user_id_fkey;
  ALTER TABLE public.cardcase_decks RENAME CONSTRAINT studies_deck_id_fkey TO cardcase_decks_deck_id_fkey;
  ALTER SEQUENCE public.studies_rowid_seq RENAME TO cardcase_decks_rowid_seq;
  DROP TABLE public.deck_selections;
`;
