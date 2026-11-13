CREATE TABLE reed_schema(version INTEGER PRIMARY KEY CHECK(version = 58));
INSERT INTO reed_schema VALUES (58);

CREATE TABLE interests(id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0),
  emoji TEXT NOT NULL DEFAULT '',
  chip_color TEXT NOT NULL DEFAULT '', book_color TEXT NOT NULL DEFAULT '');
CREATE TABLE interest_translations(
  interest_id TEXT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  name TEXT NOT NULL CHECK(length(btrim(name)) > 0), PRIMARY KEY(interest_id,language)
);
CREATE TABLE books(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), author TEXT NOT NULL CHECK(length(btrim(author)) > 0),
  popular_title TEXT NOT NULL CHECK(length(btrim(popular_title)) > 0),
  popular_language TEXT NOT NULL CHECK(length(popular_language) BETWEEN 2 AND 35),
  position INTEGER NOT NULL UNIQUE CHECK(position > 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  incorporated_at TIMESTAMPTZ,
  incorporation_order INTEGER
);
CREATE TABLE book_links(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('amazon','goodreads')),
  url TEXT NOT NULL CHECK(url LIKE 'https://%' AND length(btrim(url)) > 8), PRIMARY KEY(book_id,platform)
);
CREATE TABLE book_translations(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL CHECK(length(btrim(description)) > 0), editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0),
  PRIMARY KEY(book_id,language)
);
CREATE TABLE book_interests(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, interest_id TEXT NOT NULL REFERENCES interests(id),
  position INTEGER NOT NULL CHECK(position > 0), PRIMARY KEY(book_id,interest_id), UNIQUE(book_id,position)
);
CREATE INDEX book_interests_by_interest ON book_interests(interest_id,book_id);
CREATE TABLE users(
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL CHECK(length(btrim(display_name)) > 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);
CREATE TABLE book_merge_operations(
  source_book_id TEXT NOT NULL, target_book_id TEXT NOT NULL,
  PRIMARY KEY(source_book_id,target_book_id), CHECK(source_book_id<>target_book_id)
);
ALTER TABLE book_merge_operations ENABLE ROW LEVEL SECURITY;

CREATE TABLE accounts(
  user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN __USERNAME_MIN_LENGTH__ AND __USERNAME_MAX_LENGTH__),
  password_hash TEXT NOT NULL, time_zone TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('es','en','fr'))
);
CREATE TABLE app_roles (
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) BETWEEN 1 AND 80),
  name_es TEXT NOT NULL CHECK(length(btrim(name_es)) > 0),
  name_en TEXT NOT NULL CHECK(length(btrim(name_en)) > 0)
);
CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES app_roles(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES accounts(user_id) ON DELETE SET NULL,
  PRIMARY KEY(user_id,role_id)
);
CREATE INDEX user_roles_by_role ON user_roles(role_id,user_id);
INSERT INTO app_roles(id,name_es,name_en) VALUES ('archivist','Archivista','Archivist');
INSERT INTO user_roles(user_id,role_id) SELECT user_id,'archivist' FROM accounts WHERE lower(username)='ricardo' ON CONFLICT(user_id,role_id) DO NOTHING;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE app_roles,user_roles FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE app_roles,user_roles FROM authenticated; END IF;
END $$;
CREATE TABLE reader_xp_balances (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE reader_xp_events (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  event_key TEXT NOT NULL CHECK(length(btrim(event_key)) BETWEEN 1 AND 200),
  reward_type TEXT NOT NULL CHECK(length(btrim(reward_type)) BETWEEN 1 AND 80),
  amount BIGINT NOT NULL CHECK(amount > 0),
  balance_after BIGINT NOT NULL CHECK(balance_after >= amount AND balance_after <= 9007199254740991),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,event_key)
);
ALTER TABLE reader_xp_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_xp_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_xp_balances,reader_xp_events FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_xp_balances,reader_xp_events FROM authenticated; END IF;
END $$;
CREATE FUNCTION reader_xp_balance_on_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO reader_xp_balances(user_id) VALUES (NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER reader_xp_balance_on_account
AFTER INSERT ON accounts FOR EACH ROW EXECUTE FUNCTION reader_xp_balance_on_account();

CREATE TABLE reader_book_sort_preferences (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  sort_order TEXT NOT NULL CHECK(sort_order IN ('recent','alphabetical','interests'))
);
ALTER TABLE reader_book_sort_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_book_sort_preferences FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_book_sort_preferences FROM authenticated; END IF;
END $$;
CREATE TABLE reader_interest_preferences (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  preference TEXT NOT NULL CHECK(preference IN ('interested','not_interested')),
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5),
  PRIMARY KEY(user_id,interest_id), UNIQUE(user_id,preference,position)
);
ALTER TABLE reader_interest_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_preferences FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_preferences FROM authenticated; END IF;
END $$;
CREATE TABLE reader_interest_settings (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision > 0),
  configured_at TIMESTAMPTZ NOT NULL,
  initial_opportunity_closed_at TIMESTAMPTZ NOT NULL,
  initial_submission_at TIMESTAMPTZ
);
ALTER TABLE reader_interest_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_settings FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_settings FROM authenticated; END IF;
END $$;
CREATE TABLE reader_known_interests (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,interest_id)
);
ALTER TABLE reader_known_interests ENABLE ROW LEVEL SECURITY;
CREATE TABLE reader_interest_knowledge_visits (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  visit_id TEXT NOT NULL CHECK(length(visit_id)=36),
  interest_ids TEXT NOT NULL,
  PRIMARY KEY(user_id,visit_id)
);
ALTER TABLE reader_interest_knowledge_visits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_known_interests,reader_interest_knowledge_visits FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_known_interests,reader_interest_knowledge_visits FROM authenticated; END IF;
END $$;
CREATE TABLE reader_interest_reward_claims (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK(reward_type IN ('interested_three','not_interested_three')),
  currency TEXT NOT NULL CHECK(currency IN ('leaves','petals')),
  amount BIGINT NOT NULL CHECK(amount > 0),
  balance_after BIGINT NOT NULL CHECK(balance_after >= amount),
  granted_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,reward_type)
);
ALTER TABLE reader_interest_reward_claims ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_reward_claims FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_interest_reward_claims FROM authenticated; END IF;
END $$;
CREATE TABLE reader_language_preferences (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  languages TEXT NOT NULL, configured BOOLEAN NOT NULL CHECK(configured IN (FALSE,TRUE)), revision INTEGER NOT NULL CHECK(revision>=0)
);
CREATE TABLE reader_known_books (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,book_id)
);
ALTER TABLE reader_known_books ENABLE ROW LEVEL SECURITY;
CREATE TABLE reader_book_knowledge_visits (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  visit_id TEXT NOT NULL CHECK(length(visit_id)=36),
  book_ids TEXT NOT NULL,
  PRIMARY KEY(user_id,visit_id)
);
ALTER TABLE reader_book_knowledge_visits ENABLE ROW LEVEL SECURITY;
DO $$BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON reader_known_books,reader_book_knowledge_visits FROM anon';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON reader_known_books,reader_book_knowledge_visits FROM authenticated';
  END IF;
END $$;
ALTER TABLE reader_language_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reader_language_preferences FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reader_language_preferences FROM authenticated; END IF;
END $$;
CREATE TABLE sessions(
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE TABLE auth_limits(bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at BIGINT NOT NULL);
CREATE TABLE decks(
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35), is_recommended SMALLINT NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finished')),
  quote_source_url TEXT CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(btrim(quote_source_url)) BETWEEN 9 AND 2048)),
  contribution_policy TEXT NOT NULL DEFAULT 'owner' CHECK(contribution_policy IN ('owner','open','selected')),
  max_cards_per_contributor INTEGER CHECK(max_cards_per_contributor IS NULL OR max_cards_per_contributor > 0),
  CONSTRAINT decks_owner_limit CHECK(contribution_policy <> 'owner' OR max_cards_per_contributor IS NULL),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(id,book_id)
);
CREATE INDEX decks_by_book ON decks(book_id);
CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;
CREATE FUNCTION reed_team_only_deck_quote_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quote_source_url IS NOT NULL AND NEW.creator_user_id <> 'reed-team' THEN
    RAISE EXCEPTION 'Only team decks can have a quote source';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER team_only_deck_quote_source BEFORE INSERT ON decks FOR EACH ROW EXECUTE FUNCTION reed_team_only_deck_quote_source();
CREATE FUNCTION reed_keep_deck_quote_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quote_source_url IS DISTINCT FROM OLD.quote_source_url THEN
    RAISE EXCEPTION 'Deck quote source is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_deck_quote_source BEFORE UPDATE OF quote_source_url ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_deck_quote_source();
CREATE TABLE deck_translations(
  deck_id TEXT NOT NULL REFERENCES decks(id), language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), description TEXT NOT NULL CHECK(length(btrim(description)) > 0),
  editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0), PRIMARY KEY(deck_id,language)
);
CREATE TABLE cards(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), deck_id TEXT NOT NULL, book_id TEXT NOT NULL, parent_id TEXT,
  position INTEGER NOT NULL CHECK(position > 0), is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)),
  is_reading_guide INTEGER NOT NULL DEFAULT 0 CHECK(is_reading_guide IN (0,1)),
  creator_user_id TEXT REFERENCES users(id), language TEXT NOT NULL DEFAULT 'en' CHECK(length(language) BETWEEN 2 AND 35),
  created_at TIMESTAMPTZ, UNIQUE(id,deck_id),
  FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id) ON UPDATE CASCADE,
  FOREIGN KEY(parent_id,deck_id) REFERENCES cards(id,deck_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX root_order ON cards(deck_id,position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(deck_id,parent_id,position) WHERE parent_id IS NOT NULL;
CREATE INDEX cards_by_deck ON cards(deck_id,parent_id,position);
CREATE INDEX cards_by_note_date ON cards(deck_id,created_at DESC) WHERE created_at IS NOT NULL;
CREATE INDEX cards_by_creator ON cards(creator_user_id,deck_id);
CREATE UNIQUE INDEX one_reading_guide_per_contributor ON cards(deck_id,creator_user_id) WHERE is_reading_guide=1;
CREATE TABLE reading_guide_reviews(
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT CHECK(rejection_reason IS NULL OR length(btrim(rejection_reason)) BETWEEN 1 AND 1000),
  CHECK((status='pending' AND reviewed_at IS NULL AND rejection_reason IS NULL) OR
        (status='approved' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL) OR
        (status='rejected' AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL))
);
CREATE INDEX reading_guide_reviews_by_status ON reading_guide_reviews(status,submitted_at,card_id);
ALTER TABLE reading_guide_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL PRIVILEGES ON TABLE reading_guide_reviews FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL PRIVILEGES ON TABLE reading_guide_reviews FROM authenticated; END IF;
END $$;
CREATE TABLE deck_contributors(
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(deck_id,user_id)
);
ALTER TABLE deck_contributors ENABLE ROW LEVEL SECURITY;
CREATE INDEX deck_contributors_by_user ON deck_contributors(user_id,deck_id);
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
CREATE TABLE card_translations(
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), body TEXT NOT NULL CHECK(length(btrim(body)) > 0), PRIMARY KEY(card_id,language)
);
CREATE TABLE deck_votes(
  user_id TEXT NOT NULL REFERENCES users(id), deck_id TEXT NOT NULL REFERENCES decks(id), value INTEGER NOT NULL CHECK(value IN (-1,1)),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,deck_id)
);
CREATE INDEX votes_by_deck ON deck_votes(deck_id,value);
CREATE TABLE card_votes(
  user_id TEXT NOT NULL REFERENCES users(id), card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK(value IN (-1,1)), updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,card_id)
);
CREATE INDEX votes_by_card ON card_votes(card_id,value);
CREATE TABLE card_saves(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,card_id)
);
CREATE INDEX saves_by_reader ON card_saves(user_id,saved_at,card_id);
CREATE TABLE book_reading(
  user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id),
  status TEXT NOT NULL CHECK(status IN ('to_read','reading','read')), PRIMARY KEY(user_id,book_id)
);
CREATE TABLE leaf_wallets(
  user_id TEXT PRIMARY KEY REFERENCES users(id), balance BIGINT NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991),
  last_accrual_day TEXT NOT NULL CHECK(last_accrual_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(last_accrual_day,'YYYY-MM-DD'),'YYYY-MM-DD') = last_accrual_day)
);
CREATE TABLE petal_wallets(
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991),
  last_accrual_day TEXT CHECK(last_accrual_day IS NULL OR (last_accrual_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(last_accrual_day,'YYYY-MM-DD'),'YYYY-MM-DD') = last_accrual_day))
);
CREATE TABLE practice_answers(
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  answer TEXT NOT NULL CHECK(answer IN ('see_less','see_more')),
  answered_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,card_id)
);
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
CREATE TABLE practice_sessions(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  practice_mode TEXT NOT NULL CHECK(practice_mode IN ('reading','read','saved','mixed','discover')),
  card_ids TEXT NOT NULL, card_index INTEGER NOT NULL DEFAULT 0 CHECK(card_index BETWEEN 0 AND 5),
  cost INTEGER NOT NULL CHECK(cost IN (2,3)), started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
  completed_local_day TEXT CHECK(completed_local_day IS NULL OR (completed_local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(completed_local_day,'YYYY-MM-DD'),'YYYY-MM-DD') = completed_local_day)),
  cancelled_at TIMESTAMPTZ, language_snapshot TEXT
);
CREATE UNIQUE INDEX one_active_practice_session ON practice_sessions(user_id) WHERE completed_at IS NULL AND cancelled_at IS NULL;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE practice_session_cards(
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id), position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4),
  PRIMARY KEY(session_id,card_id), UNIQUE(session_id,position)
);
CREATE INDEX practice_session_cards_by_card ON practice_session_cards(card_id,session_id);
ALTER TABLE practice_session_cards ENABLE ROW LEVEL SECURITY;
CREATE TABLE card_views (
  user_id TEXT NOT NULL REFERENCES users(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,card_id)
);

CREATE TABLE cardcase_decks(rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), deck_id TEXT NOT NULL REFERENCES decks(id), PRIMARY KEY(user_id,deck_id));
CREATE TABLE daily_ideas(day TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id));
CREATE TABLE daily_idea_views(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,day)
);
ALTER TABLE daily_idea_views ENABLE ROW LEVEL SECURITY;
CREATE TABLE feedback_submissions(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL, message TEXT NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND __FEEDBACK_MESSAGE_MAX_LENGTH__),
  page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND __FEEDBACK_PAGE_MAX_LENGTH__),
  language TEXT NOT NULL CHECK(language IN ('es','en')), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX feedback_by_date ON feedback_submissions(created_at DESC);

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

CREATE FUNCTION reed_check_card_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id,parent_id) AS (
      SELECT id,parent_id FROM cards WHERE id=NEW.parent_id AND deck_id=NEW.deck_id
      UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id=a.parent_id AND c.deck_id=NEW.deck_id
    ) SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN RAISE EXCEPTION 'Card tree cycle'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER no_card_cycles_insert BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_cycle();
CREATE TRIGGER no_card_cycles_update BEFORE UPDATE OF parent_id ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_cycle();

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
