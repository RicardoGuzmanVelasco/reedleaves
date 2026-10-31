// Frozen appearance backfill for the seven approved, already existing IDs.
// Active editorial values live in content/catalog/genres.csv; never reclassify books here.
export const INTEREST_APPEARANCE_SQL=`
  ALTER TABLE genres ADD COLUMN emoji TEXT NOT NULL DEFAULT '';
  ALTER TABLE genres ADD COLUMN color TEXT NOT NULL DEFAULT '';
  UPDATE genres SET emoji=CASE id
    WHEN 'personal-growth' THEN '🌱' WHEN 'finance' THEN '💰'
    WHEN 'productivity' THEN '🎯' WHEN 'society' THEN '🌍'
    WHEN 'software' THEN '💻' WHEN 'mindfulness' THEN '🧘'
    WHEN 'metaphysics' THEN '🔮' ELSE emoji END,
  color=CASE id
    WHEN 'personal-growth' THEN '#E4F0CC' WHEN 'finance' THEN '#E8D3A4'
    WHEN 'productivity' THEN '#D9EDB6' WHEN 'society' THEN '#E4EFFB'
    WHEN 'software' THEN '#E4EFFB' WHEN 'mindfulness' THEN '#FAD7CE'
    WHEN 'metaphysics' THEN '#FAD7CE' ELSE color END;
`;
