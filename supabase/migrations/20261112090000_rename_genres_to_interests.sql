ALTER TABLE public.genres RENAME TO interests;
ALTER TABLE public.genre_translations RENAME TO interest_translations;
ALTER TABLE public.interest_translations RENAME COLUMN genre_id TO interest_id;
ALTER TABLE public.book_genres RENAME TO book_interests;
ALTER TABLE public.book_interests RENAME COLUMN genre_id TO interest_id;
ALTER INDEX public.book_genres_by_genre RENAME TO book_interests_by_interest;
ALTER TABLE public.interests RENAME CONSTRAINT genres_pkey TO interests_pkey;
ALTER TABLE public.interest_translations RENAME CONSTRAINT genre_translations_pkey TO interest_translations_pkey;
ALTER TABLE public.book_interests RENAME CONSTRAINT book_genres_pkey TO book_interests_pkey;
