// Repaso hito 2 (pruebas): one definition table per test kind, append-only results and the test drawn for each
// session card. Purely additive; no existing row changes.
const definitionTable=(name,{trim,strict})=>`CREATE TABLE ${name}(
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  fragment TEXT NOT NULL CHECK(fragment = ${trim}(fragment)),
  PRIMARY KEY(card_id,language,fragment)
)${strict};`;

const sqliteTables=`${definitionTable("card_test_hide_title",{trim:"trim",strict:" STRICT"})}
${definitionTable("card_test_hide_content",{trim:"trim",strict:" STRICT"})}
CREATE TABLE practice_results(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('passed','failed')),
  answered_at TEXT NOT NULL,
  local_day TEXT NOT NULL CHECK(local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(local_day,'+0 days') IS local_day),
  UNIQUE(session_id,card_id)
) STRICT;
CREATE INDEX practice_results_by_reader ON practice_results(user_id,card_id,answered_at);
CREATE TRIGGER practice_results_append_only BEFORE UPDATE ON practice_results
BEGIN SELECT RAISE(ABORT,'Practice results are append-only'); END;`;

const postgresTables=`${definitionTable("card_test_hide_title",{trim:"btrim",strict:""})}
ALTER TABLE card_test_hide_title ENABLE ROW LEVEL SECURITY;
${definitionTable("card_test_hide_content",{trim:"btrim",strict:""})}
ALTER TABLE card_test_hide_content ENABLE ROW LEVEL SECURITY;
CREATE TABLE practice_results(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('passed','failed')),
  answered_at TIMESTAMPTZ NOT NULL,
  local_day TEXT NOT NULL CHECK(local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(local_day,'YYYY-MM-DD'),'YYYY-MM-DD') = local_day),
  UNIQUE(session_id,card_id)
);
CREATE INDEX practice_results_by_reader ON practice_results(user_id,card_id,answered_at);
ALTER TABLE practice_results ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION reed_practice_results_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Practice results are append-only';
END $$;
CREATE TRIGGER practice_results_append_only BEFORE UPDATE ON practice_results FOR EACH ROW EXECUTE FUNCTION reed_practice_results_append_only();`;

// Current schemas embed the same tables (schema.sql / schema.postgres.sql); the migrations add the session column.
export const PRACTICE_TESTS_SQLITE=`ALTER TABLE practice_session_cards ADD COLUMN test_kind TEXT;
${sqliteTables}`;

export const PRACTICE_TESTS_POSTGRES=`ALTER TABLE practice_session_cards ADD COLUMN test_kind TEXT;
${postgresTables}`;
