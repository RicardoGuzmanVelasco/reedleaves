export const INTEREST_COLOR_MIGRATION_SQLITE = `
  ALTER TABLE genres ADD COLUMN chip_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE genres ADD COLUMN book_color TEXT NOT NULL DEFAULT '';
  UPDATE genres SET chip_color=CASE id
    WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#9AB5EC'
    WHEN 'metaphysics' THEN '#D9AEFF' WHEN 'mindfulness' THEN '#FFC0D9'
    WHEN 'personal-growth' THEN '#81F265' WHEN 'productivity' THEN '#FF8040'
    WHEN 'psychology' THEN '#FF8DB3' WHEN 'society' THEN '#6B9CFF'
    WHEN 'software' THEN '#BFC1C8' ELSE chip_color END,
    book_color=CASE id
    WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#8CA8DC'
    WHEN 'metaphysics' THEN '#B99AED' WHEN 'mindfulness' THEN '#FFC0D9'
    WHEN 'personal-growth' THEN '#AAD57B' WHEN 'productivity' THEN '#FE8957'
    WHEN 'psychology' THEN '#FF6E9E' WHEN 'society' THEN '#2D73FF'
    WHEN 'software' THEN '#BBC2C9' ELSE book_color END;
  INSERT INTO genres(id,emoji,color,chip_color,book_color)
  VALUES ('communication','💬','#59C8FF','#59C8FF','#0099FF')
  ON CONFLICT(id) DO UPDATE SET emoji=excluded.emoji,color=excluded.color,
    chip_color=excluded.chip_color,book_color=excluded.book_color;
  UPDATE genres SET color=chip_color;
  INSERT INTO genre_translations(genre_id,language,name) VALUES
    ('communication','es','Comunicación'),('communication','en','Communication')
  ON CONFLICT(genre_id,language) DO UPDATE SET name=excluded.name;
`;

export const INTEREST_COLOR_MIGRATION_POSTGRES = `
  ALTER TABLE public.genres ADD COLUMN IF NOT EXISTS chip_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.genres ADD COLUMN IF NOT EXISTS book_color TEXT NOT NULL DEFAULT '';
  UPDATE public.genres AS g SET chip_color=v.chip_color, book_color=v.book_color
  FROM (VALUES
    ('finance','#EEC466','#EEC466'),
    ('leadership','#9AB5EC','#8CA8DC'),
    ('metaphysics','#D9AEFF','#B99AED'),
    ('mindfulness','#FFC0D9','#FFC0D9'),
    ('personal-growth','#81F265','#AAD57B'),
    ('productivity','#FF8040','#FE8957'),
    ('psychology','#FF8DB3','#FF6E9E'),
    ('society','#6B9CFF','#2D73FF'),
    ('software','#BFC1C8','#BBC2C9')
  ) AS v(id,chip_color,book_color)
  WHERE g.id=v.id;
  INSERT INTO public.genres(id,emoji,color,chip_color,book_color)
  VALUES ('communication','💬','#59C8FF','#59C8FF','#0099FF')
  ON CONFLICT(id) DO UPDATE SET emoji=EXCLUDED.emoji,color=EXCLUDED.color,
    chip_color=EXCLUDED.chip_color,book_color=EXCLUDED.book_color;
  UPDATE public.genres SET color=chip_color;
  INSERT INTO public.genre_translations(genre_id,language,name) VALUES
    ('communication','es','Comunicación'),('communication','en','Communication')
  ON CONFLICT(genre_id,language) DO UPDATE SET name=EXCLUDED.name;
`;
