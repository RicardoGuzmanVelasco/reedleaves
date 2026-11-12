export const INTEREST_COLOR_MIGRATION_SQLITE = `
  ALTER TABLE genres ADD COLUMN chip_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE genres ADD COLUMN book_color TEXT NOT NULL DEFAULT '';
  UPDATE genres SET chip_color=CASE id
    WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#9AB5EC'
    WHEN 'metaphysics' THEN '#D9AEFF' WHEN 'mindfulness' THEN '#FFC0D9'
    WHEN 'personal-growth' THEN '#81F265' WHEN 'productivity' THEN '#FF8040'
    WHEN 'psychology' THEN '#FF8DB3' WHEN 'society' THEN '#6B9CFF'
    WHEN 'software' THEN '#BFC1C8' WHEN 'communication' THEN '#59C8FF' ELSE color END,
    book_color=CASE id
    WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#8CA8DC'
    WHEN 'metaphysics' THEN '#B99AED' WHEN 'mindfulness' THEN '#FFC0D9'
    WHEN 'personal-growth' THEN '#AAD57B' WHEN 'productivity' THEN '#FE8957'
    WHEN 'psychology' THEN '#FF6E9E' WHEN 'society' THEN '#2D73FF'
    WHEN 'software' THEN '#BBC2C9' WHEN 'communication' THEN '#0099FF' ELSE color END;
`;

export const INTEREST_COLOR_MIGRATION_POSTGRES = `
  ALTER TABLE public.genres ADD COLUMN IF NOT EXISTS chip_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.genres ADD COLUMN IF NOT EXISTS book_color TEXT NOT NULL DEFAULT '';
  UPDATE public.genres SET
    chip_color=CASE id
      WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#9AB5EC'
      WHEN 'metaphysics' THEN '#D9AEFF' WHEN 'mindfulness' THEN '#FFC0D9'
      WHEN 'personal-growth' THEN '#81F265' WHEN 'productivity' THEN '#FF8040'
      WHEN 'psychology' THEN '#FF8DB3' WHEN 'society' THEN '#6B9CFF'
      WHEN 'software' THEN '#BFC1C8' WHEN 'communication' THEN '#59C8FF' ELSE color END,
    book_color=CASE id
      WHEN 'finance' THEN '#EEC466' WHEN 'leadership' THEN '#8CA8DC'
      WHEN 'metaphysics' THEN '#B99AED' WHEN 'mindfulness' THEN '#FFC0D9'
      WHEN 'personal-growth' THEN '#AAD57B' WHEN 'productivity' THEN '#FE8957'
      WHEN 'psychology' THEN '#FF6E9E' WHEN 'society' THEN '#2D73FF'
      WHEN 'software' THEN '#BBC2C9' WHEN 'communication' THEN '#0099FF' ELSE color END;
`;
