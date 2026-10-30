// Frozen approved appearance update. Existing IDs and all relationships stay intact.
export const INTEREST_CHOICE_APPEARANCE_SQL=`
UPDATE genres SET color=CASE id
  WHEN 'finance' THEN '#EDC566' WHEN 'metaphysics' THEN '#B99AED'
  WHEN 'mindfulness' THEN '#F09FCB' WHEN 'personal-growth' THEN '#AAD57B'
  WHEN 'productivity' THEN '#F2937D' WHEN 'society' THEN '#8EC5EA'
  WHEN 'software' THEN '#BBC2C9' ELSE color END,
  emoji=CASE WHEN id='mindfulness' THEN '🧘‍♀️' ELSE emoji END
WHERE id IN ('finance','metaphysics','mindfulness','personal-growth','productivity','society','software');
`;
