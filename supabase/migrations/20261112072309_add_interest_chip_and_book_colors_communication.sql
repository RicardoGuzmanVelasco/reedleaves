ALTER TABLE public.genres
  ADD COLUMN chip_color TEXT NOT NULL DEFAULT '',
  ADD COLUMN book_color TEXT NOT NULL DEFAULT '';

UPDATE public.genres AS g
SET chip_color = v.chip_color,
    book_color = v.book_color
FROM (VALUES
  ('finance', '#EEC466', '#EEC466'),
  ('leadership', '#9AB5EC', '#8CA8DC'),
  ('metaphysics', '#D9AEFF', '#B99AED'),
  ('mindfulness', '#FFC0D9', '#FFC0D9'),
  ('personal-growth', '#81F265', '#AAD57B'),
  ('productivity', '#FF8040', '#FE8957'),
  ('psychology', '#FF8DB3', '#FF6E9E'),
  ('society', '#6B9CFF', '#2D73FF'),
  ('software', '#BFC1C8', '#BBC2C9')
) AS v(id, chip_color, book_color)
WHERE g.id = v.id;

INSERT INTO public.genres(id, emoji, color, chip_color, book_color)
VALUES ('communication', '💬', '#59C8FF', '#59C8FF', '#0099FF')
ON CONFLICT (id) DO UPDATE
SET emoji = EXCLUDED.emoji,
    color = EXCLUDED.color,
    chip_color = EXCLUDED.chip_color,
    book_color = EXCLUDED.book_color;

INSERT INTO public.genre_translations(genre_id, language, name)
VALUES ('communication', 'es', 'Comunicación'),
       ('communication', 'en', 'Communication')
ON CONFLICT (genre_id, language) DO UPDATE
SET name = EXCLUDED.name;
