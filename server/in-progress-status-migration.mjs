// Schema v67 (SQLite) / v59 (PostgreSQL): decks.status 'draft' is renamed 'in_progress'.
// 'draft' stays reserved for unsaved text; an unfinished deck is "in progress" (pair of 'finished').

const DECKS_SQLITE=`CREATE TABLE decks_new (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  is_recommended INTEGER NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','finished')),
  quote_source_url TEXT CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(trim(quote_source_url)) BETWEEN 9 AND 2048)),
  contribution_policy TEXT NOT NULL DEFAULT 'owner' CHECK(contribution_policy IN ('owner','open','selected')),
  max_cards_per_contributor INTEGER CHECK(max_cards_per_contributor IS NULL OR max_cards_per_contributor > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(contribution_policy <> 'owner' OR max_cards_per_contributor IS NULL),
  UNIQUE(id,book_id)
) STRICT;`;

export function migrateSqliteToInProgressStatus(db) {
  // Rebuild with foreign keys disabled outside the transaction (the CHECK changes);
  // every table that references decks keeps its rows, and the result is checked before commit.
  db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  try {
    if (db.prepare("PRAGMA user_version").get().user_version >= 67) { db.exec("COMMIT"); return; }
    const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
    for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
    db.exec(DECKS_SQLITE);
    db.exec(`INSERT INTO decks_new(id,book_id,creator_user_id,language,is_recommended,status,quote_source_url,contribution_policy,max_cards_per_contributor,created_at)
      SELECT id,book_id,creator_user_id,language,is_recommended,CASE status WHEN 'draft' THEN 'in_progress' ELSE status END,quote_source_url,contribution_policy,max_cards_per_contributor,created_at FROM decks;
      DROP TABLE decks; ALTER TABLE decks_new RENAME TO decks;
      CREATE INDEX decks_by_book ON decks(book_id);
      CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;`);
    for (const trigger of triggers) db.exec(trigger.sql.replaceAll("'draft'","'in_progress'"));
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
    db.exec("PRAGMA user_version=67; COMMIT;");
  } catch(error) { db.exec("ROLLBACK"); throw error; }
  finally { db.exec("PRAGMA foreign_keys=ON;"); }
}

// PostgreSQL: the caller holds ACCESS EXCLUSIVE locks and has checked reed_schema.
export const IN_PROGRESS_STATUS_POSTGRES=`
DO $$
DECLARE found RECORD;
BEGIN
  -- Constraint names depend on how the table was reached (renames in older migrations).
  FOR found IN SELECT conname FROM pg_constraint WHERE conrelid='public.decks'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ~ '\\mstatus\\M' LOOP
    EXECUTE format('ALTER TABLE public.decks DROP CONSTRAINT %I',found.conname);
  END LOOP;
END $$;
UPDATE public.decks SET status='in_progress' WHERE status='draft';
ALTER TABLE public.decks ALTER COLUMN status SET DEFAULT 'in_progress';
ALTER TABLE public.decks ADD CONSTRAINT decks_status_check CHECK(status IN ('in_progress','finished'));
CREATE OR REPLACE FUNCTION reed_freeze_collective_contributors() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_deck TEXT; deck_status TEXT;
BEGIN
  target_deck := CASE WHEN TG_OP='DELETE' THEN OLD.deck_id ELSE NEW.deck_id END;
  SELECT status INTO deck_status FROM decks WHERE id=target_deck;
  IF deck_status <> 'in_progress' THEN RAISE EXCEPTION 'Finished contributor list is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id AND NOT (
    OLD.creator_user_id='reed-team' AND OLD.status='finished'
  )) OR (NEW.book_id IS DISTINCT FROM OLD.book_id AND NOT EXISTS (
    SELECT 1 FROM book_merge_operations m WHERE m.source_book_id=OLD.book_id AND m.target_book_id=NEW.book_id
  )) OR (NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'in_progress') THEN
    RAISE EXCEPTION 'Deck ownership is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION reed_keep_finished_deck() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'in_progress' THEN RAISE EXCEPTION 'Finished deck cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION reed_keep_finished_card() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'in_progress' THEN RAISE EXCEPTION 'Finished content is immutable; cards cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION reed_keep_finished_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deck_status TEXT;
BEGIN
  SELECT d.status INTO deck_status FROM decks d JOIN cards c ON c.deck_id=d.id WHERE c.id=OLD.card_id;
  IF deck_status <> 'in_progress' THEN RAISE EXCEPTION 'Finished content is immutable; card translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION reed_keep_finished_deck_translation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'in_progress' THEN RAISE EXCEPTION 'Finished content is immutable; deck translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
`;
