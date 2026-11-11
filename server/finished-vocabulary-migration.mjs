// Schema v61 (SQLite) / v53 (PostgreSQL): domain vocabulary cleanup.
// - decks.status: published -> finished; archived (empty) decks are deleted.
// - practice answers: soon/remembered -> see_less/see_more (stored answers are discarded).
// - practice_sessions.topic -> practice_mode.
// - removed: users.can_create_decks, books/decks.editorial_status, reader_display_preferences.

const DECK_TABLES_SQLITE=`CREATE TABLE decks_new (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  is_recommended INTEGER NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finished')),
  quote_source_url TEXT CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(trim(quote_source_url)) BETWEEN 9 AND 2048)),
  kind TEXT NOT NULL DEFAULT 'standard' CHECK(kind IN ('standard','collective')),
  contribution_policy TEXT NOT NULL DEFAULT 'owner' CHECK(contribution_policy IN ('owner','open','selected')),
  max_cards_per_contributor INTEGER CHECK(max_cards_per_contributor IS NULL OR max_cards_per_contributor > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((kind='standard' AND contribution_policy='owner' AND max_cards_per_contributor IS NULL) OR
        (kind='collective' AND contribution_policy IN ('open','selected'))),
  UNIQUE(id,book_id)
) STRICT;`;

const DECK_TRIGGERS_SQLITE=`CREATE TRIGGER keep_deck_owner BEFORE UPDATE OF creator_user_id,book_id,language ON decks
WHEN (NEW.creator_user_id IS NOT OLD.creator_user_id AND NOT (
  OLD.creator_user_id='reed-team' AND OLD.status='finished'
)) OR (NEW.book_id <> OLD.book_id AND NOT EXISTS (
  SELECT 1 FROM book_merge_operations m WHERE m.source_book_id=OLD.book_id AND m.target_book_id=NEW.book_id
)) OR (NEW.language <> OLD.language AND OLD.status <> 'draft')
BEGIN SELECT RAISE(ABORT,'Deck ownership is immutable'); END;
CREATE TRIGGER keep_finished_deck BEFORE DELETE ON decks WHEN OLD.status <> 'draft'
BEGIN SELECT RAISE(ABORT,'Finished deck cannot be deleted'); END;`;

const REPLACED_TRIGGERS=new Set(["check_deck_author_insert","keep_deck_owner","keep_published_deck"]);

export function migrateSqliteToFinishedVocabulary(db) {
  // Rebuild with foreign keys disabled outside the transaction; every table that
  // references decks keeps its rows, and the result is checked before commit.
  db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  try {
    if (db.prepare("PRAGMA user_version").get().user_version >= 61) { db.exec("COMMIT"); return; }
    const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
    for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
    // Empty archived decks are deleted. An archived deck that somehow has cards is kept as finished.
    db.exec(`CREATE TEMP TABLE discarded_decks AS SELECT id FROM decks WHERE status='archived' AND NOT EXISTS (SELECT 1 FROM cards WHERE cards.deck_id=decks.id);
      DELETE FROM deck_translations WHERE deck_id IN (SELECT id FROM discarded_decks);
      DELETE FROM deck_contributors WHERE deck_id IN (SELECT id FROM discarded_decks);
      DELETE FROM deck_votes WHERE deck_id IN (SELECT id FROM discarded_decks);
      DELETE FROM deck_selections WHERE deck_id IN (SELECT id FROM discarded_decks);
      DELETE FROM studies WHERE deck_id IN (SELECT id FROM discarded_decks);`);
    db.exec(DECK_TABLES_SQLITE);
    db.exec(`INSERT INTO decks_new(id,book_id,creator_user_id,language,is_recommended,status,quote_source_url,kind,contribution_policy,max_cards_per_contributor,created_at)
      SELECT id,book_id,creator_user_id,language,is_recommended,CASE status WHEN 'draft' THEN 'draft' ELSE 'finished' END,quote_source_url,kind,contribution_policy,max_cards_per_contributor,created_at
      FROM decks WHERE id NOT IN (SELECT id FROM discarded_decks);
      DROP TABLE decks; ALTER TABLE decks_new RENAME TO decks; DROP TABLE discarded_decks;
      CREATE INDEX decks_by_book ON decks(book_id);
      CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;`);
    db.exec(`ALTER TABLE users DROP COLUMN can_create_decks;
      ALTER TABLE books DROP COLUMN editorial_status;
      DROP TABLE reader_display_preferences;
      DROP TABLE practice_answers;
      CREATE TABLE practice_answers (
        user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        answer TEXT NOT NULL CHECK(answer IN ('see_less','see_more')),
        answered_at TEXT NOT NULL,
        PRIMARY KEY(user_id,card_id)
      ) STRICT;
      ALTER TABLE practice_sessions RENAME COLUMN topic TO practice_mode;`);
    db.exec(DECK_TRIGGERS_SQLITE);
    for (const trigger of triggers) if (!REPLACED_TRIGGERS.has(trigger.name)) db.exec(trigger.sql.replaceAll("Published ","Finished "));
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
    db.exec("PRAGMA user_version=61; COMMIT;");
  } catch(error) { db.exec("ROLLBACK"); throw error; }
  finally { db.exec("PRAGMA foreign_keys=ON;"); }
}

// PostgreSQL: the caller holds ACCESS EXCLUSIVE locks and has checked reed_schema.
export const FINISHED_VOCABULARY_POSTGRES_SQL=`
DROP TRIGGER IF EXISTS check_deck_author_insert ON decks;
DROP TRIGGER IF EXISTS keep_deck_owner ON decks;
DROP TRIGGER IF EXISTS keep_published_deck ON decks;
DROP TRIGGER IF EXISTS freeze_cards_delete ON cards;
DROP TRIGGER IF EXISTS freeze_card_translation_delete ON card_translations;
DROP TRIGGER IF EXISTS freeze_deck_translation_delete ON deck_translations;
DROP TRIGGER IF EXISTS freeze_collective_contributors ON deck_contributors;
DROP FUNCTION IF EXISTS reed_check_deck_author() CASCADE;
DROP FUNCTION IF EXISTS reed_keep_deck_owner() CASCADE;
DROP FUNCTION IF EXISTS reed_keep_published_deck() CASCADE;
DROP FUNCTION IF EXISTS reed_keep_published_card() CASCADE;
DROP FUNCTION IF EXISTS reed_keep_published_card_translation() CASCADE;
DROP FUNCTION IF EXISTS reed_keep_published_deck_translation() CASCADE;
DROP FUNCTION IF EXISTS reed_freeze_collective_contributors() CASCADE;
CREATE TEMP TABLE discarded_decks ON COMMIT DROP AS SELECT id FROM decks d WHERE status='archived' AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.deck_id=d.id);
DELETE FROM deck_translations WHERE deck_id IN (SELECT id FROM discarded_decks);
DELETE FROM deck_contributors WHERE deck_id IN (SELECT id FROM discarded_decks);
DELETE FROM deck_votes WHERE deck_id IN (SELECT id FROM discarded_decks);
DELETE FROM deck_selections WHERE deck_id IN (SELECT id FROM discarded_decks);
DELETE FROM studies WHERE deck_id IN (SELECT id FROM discarded_decks);
DELETE FROM decks WHERE id IN (SELECT id FROM discarded_decks);
ALTER TABLE decks DROP CONSTRAINT decks_status_check;
UPDATE decks SET status='finished' WHERE status IN ('published','archived');
ALTER TABLE decks ADD CONSTRAINT decks_status_check CHECK(status IN ('draft','finished'));
ALTER TABLE decks DROP COLUMN editorial_status;
ALTER TABLE books DROP COLUMN editorial_status;
ALTER TABLE users DROP COLUMN can_create_decks;
DROP TABLE reader_display_preferences;
DELETE FROM practice_answers;
ALTER TABLE practice_answers DROP CONSTRAINT practice_answers_answer_check;
ALTER TABLE practice_answers ADD CONSTRAINT practice_answers_answer_check CHECK(answer IN ('see_less','see_more'));
ALTER TABLE practice_sessions RENAME COLUMN topic TO practice_mode;
ALTER TABLE practice_sessions RENAME CONSTRAINT practice_sessions_topic_check TO practice_sessions_practice_mode_check;
CREATE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id AND NOT (
    OLD.creator_user_id='reed-team' AND OLD.status='finished'
  )) OR (NEW.book_id IS DISTINCT FROM OLD.book_id AND NOT EXISTS (
    SELECT 1 FROM book_merge_operations m WHERE m.source_book_id=OLD.book_id AND m.target_book_id=NEW.book_id
  )) OR (NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'draft') THEN
    RAISE EXCEPTION 'Deck ownership is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_deck_owner BEFORE UPDATE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_deck_owner();
CREATE FUNCTION reed_keep_finished_deck() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Finished deck cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER keep_finished_deck BEFORE DELETE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_finished_deck();
CREATE FUNCTION reed_keep_finished_card() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft' THEN RAISE EXCEPTION 'Finished content is immutable; cards cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION reed_keep_finished_card();
CREATE FUNCTION reed_keep_finished_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deck_status TEXT;
BEGIN
  SELECT d.status INTO deck_status FROM decks d JOIN cards c ON c.deck_id=d.id WHERE c.id=OLD.card_id;
  IF deck_status <> 'draft' THEN RAISE EXCEPTION 'Finished content is immutable; card translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_card_translation_delete BEFORE DELETE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_keep_finished_card_translation();
CREATE FUNCTION reed_keep_finished_deck_translation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft' THEN RAISE EXCEPTION 'Finished content is immutable; deck translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_deck_translation_delete BEFORE DELETE ON deck_translations FOR EACH ROW EXECUTE FUNCTION reed_keep_finished_deck_translation();
CREATE FUNCTION reed_freeze_collective_contributors() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_deck TEXT; deck_status TEXT;
BEGIN
  target_deck := CASE WHEN TG_OP='DELETE' THEN OLD.deck_id ELSE NEW.deck_id END;
  SELECT status INTO deck_status FROM decks WHERE id=target_deck;
  IF deck_status <> 'draft' THEN RAISE EXCEPTION 'Finished contributor list is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER freeze_collective_contributors BEFORE INSERT OR UPDATE OR DELETE ON deck_contributors
FOR EACH ROW EXECUTE FUNCTION reed_freeze_collective_contributors();
ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
UPDATE reed_schema SET version=53;
ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=53);`;
