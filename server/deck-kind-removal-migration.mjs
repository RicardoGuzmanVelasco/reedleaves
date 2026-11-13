// Schema v66 (SQLite) / v58 (PostgreSQL): decks.kind is dropped.
// It repeated contribution_policy: standard <=> owner, collective <=> open or selected.
// A deck is collective when its contribution_policy is not 'owner'.

const DECKS_SQLITE=`CREATE TABLE decks_new (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  is_recommended INTEGER NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finished')),
  quote_source_url TEXT CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(trim(quote_source_url)) BETWEEN 9 AND 2048)),
  contribution_policy TEXT NOT NULL DEFAULT 'owner' CHECK(contribution_policy IN ('owner','open','selected')),
  max_cards_per_contributor INTEGER CHECK(max_cards_per_contributor IS NULL OR max_cards_per_contributor > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(contribution_policy <> 'owner' OR max_cards_per_contributor IS NULL),
  UNIQUE(id,book_id)
) STRICT;`;

export function migrateSqliteToNoDeckKind(db) {
  // Rebuild with foreign keys disabled outside the transaction; every table that
  // references decks keeps its rows, and the result is checked before commit.
  db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  try {
    if (db.prepare("PRAGMA user_version").get().user_version >= 66) { db.exec("COMMIT"); return; }
    const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
    for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
    db.exec(DECKS_SQLITE);
    db.exec(`INSERT INTO decks_new(id,book_id,creator_user_id,language,is_recommended,status,quote_source_url,contribution_policy,max_cards_per_contributor,created_at)
      SELECT id,book_id,creator_user_id,language,is_recommended,status,quote_source_url,contribution_policy,max_cards_per_contributor,created_at FROM decks;
      DROP TABLE decks; ALTER TABLE decks_new RENAME TO decks;
      CREATE INDEX decks_by_book ON decks(book_id);
      CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;`);
    for (const trigger of triggers) db.exec(trigger.sql);
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
    db.exec("PRAGMA user_version=66; COMMIT;");
  } catch(error) { db.exec("ROLLBACK"); throw error; }
  finally { db.exec("PRAGMA foreign_keys=ON;"); }
}

// PostgreSQL: the caller holds ACCESS EXCLUSIVE locks and has checked reed_schema.
export const DECK_KIND_REMOVAL_POSTGRES=`
DO $$
DECLARE found RECORD;
BEGIN
  -- Constraint names depend on how the table was reached (renames in older migrations).
  FOR found IN SELECT conname FROM pg_constraint WHERE conrelid='public.decks'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ~ '\\mkind\\M' LOOP
    EXECUTE format('ALTER TABLE public.decks DROP CONSTRAINT %I',found.conname);
  END LOOP;
END $$;
ALTER TABLE public.decks DROP COLUMN kind;
ALTER TABLE public.decks ADD CONSTRAINT decks_owner_limit CHECK(contribution_policy <> 'owner' OR max_cards_per_contributor IS NULL);
`;
