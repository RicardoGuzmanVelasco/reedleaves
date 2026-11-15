// Schema v68 (SQLite) / v60 (PostgreSQL): practice_sessions.practice_mode becomes the eight Repaso
// topic ids. 'discover' is renamed 'interests'; 'dailyDeck', 'novelties' and 'teamPicks' are new.
const TOPICS="'reading','read','saved','mixed','dailyDeck','interests','novelties','teamPicks'";

const PRACTICE_SESSIONS_SQLITE=`CREATE TABLE practice_sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  practice_mode TEXT NOT NULL CHECK(practice_mode IN (${TOPICS})),
  card_ids TEXT NOT NULL,
  card_index INTEGER NOT NULL DEFAULT 0 CHECK(card_index BETWEEN 0 AND 5),
  cost INTEGER NOT NULL CHECK(cost IN (2,3)),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  completed_local_day TEXT CHECK(completed_local_day IS NULL OR (completed_local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(completed_local_day,'+0 days') IS completed_local_day)),
  cancelled_at TEXT,
  language_snapshot TEXT
) STRICT;`;

export function migrateSqliteToPracticeTopics(db) {
  db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  try {
    if (db.prepare("PRAGMA user_version").get().user_version >= 68) { db.exec("COMMIT"); return; }
    const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='practice_sessions'").all();
    for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
    db.exec(PRACTICE_SESSIONS_SQLITE);
    db.exec(`INSERT INTO practice_sessions_new(id,user_id,practice_mode,card_ids,card_index,cost,started_at,completed_at,completed_local_day,cancelled_at,language_snapshot)
      SELECT id,user_id,CASE practice_mode WHEN 'discover' THEN 'interests' ELSE practice_mode END,card_ids,card_index,cost,started_at,completed_at,completed_local_day,cancelled_at,language_snapshot FROM practice_sessions;
      DROP TABLE practice_sessions; ALTER TABLE practice_sessions_new RENAME TO practice_sessions;
      CREATE UNIQUE INDEX one_active_practice_session ON practice_sessions(user_id) WHERE completed_at IS NULL AND cancelled_at IS NULL;`);
    for (const trigger of triggers) db.exec(trigger.sql);
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
    db.exec("PRAGMA user_version=68; COMMIT;");
  } catch(error) { db.exec("ROLLBACK"); throw error; }
  finally { db.exec("PRAGMA foreign_keys=ON;"); }
}

// PostgreSQL: the caller holds the ACCESS EXCLUSIVE lock and has checked reed_schema.
export const PRACTICE_TOPICS_POSTGRES=`
DO $$
DECLARE found RECORD;
BEGIN
  FOR found IN SELECT conname FROM pg_constraint WHERE conrelid='public.practice_sessions'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ~ '\\mpractice_mode\\M' LOOP
    EXECUTE format('ALTER TABLE public.practice_sessions DROP CONSTRAINT %I',found.conname);
  END LOOP;
END $$;
UPDATE public.practice_sessions SET practice_mode='interests' WHERE practice_mode='discover';
ALTER TABLE public.practice_sessions ADD CONSTRAINT practice_sessions_practice_mode_check CHECK(practice_mode IN (${TOPICS}));
`;
