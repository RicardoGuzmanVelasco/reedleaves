// Schema v63 (SQLite) / v55 (PostgreSQL): the interests tables stop using the legacy "genre" name.
// genres -> interests, genre_translations -> interest_translations, book_genres -> book_interests,
// and their genre_id columns -> interest_id. Data is untouched.

export const INTEREST_TABLE_RENAME_SQLITE=`
  ALTER TABLE genres RENAME TO interests;
  ALTER TABLE genre_translations RENAME TO interest_translations;
  ALTER TABLE interest_translations RENAME COLUMN genre_id TO interest_id;
  ALTER TABLE book_genres RENAME TO book_interests;
  ALTER TABLE book_interests RENAME COLUMN genre_id TO interest_id;
  DROP INDEX book_genres_by_genre;
  CREATE INDEX book_interests_by_interest ON book_interests(interest_id,book_id);
`;

export const INTEREST_TABLE_RENAME_POSTGRES=`
  ALTER TABLE public.genres RENAME TO interests;
  ALTER TABLE public.genre_translations RENAME TO interest_translations;
  ALTER TABLE public.interest_translations RENAME COLUMN genre_id TO interest_id;
  ALTER TABLE public.book_genres RENAME TO book_interests;
  ALTER TABLE public.book_interests RENAME COLUMN genre_id TO interest_id;
  ALTER INDEX public.book_genres_by_genre RENAME TO book_interests_by_interest;
  ALTER TABLE public.interests RENAME CONSTRAINT genres_pkey TO interests_pkey;
  ALTER TABLE public.interest_translations RENAME CONSTRAINT genre_translations_pkey TO interest_translations_pkey;
  ALTER TABLE public.book_interests RENAME CONSTRAINT book_genres_pkey TO book_interests_pkey;
`;
