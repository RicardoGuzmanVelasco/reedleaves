-- Released schema from feb47a1:server/schema.postgres.sql (PostgreSQL v27).
CREATE TABLE reed_schema(version INTEGER PRIMARY KEY CHECK(version = 27));
INSERT INTO reed_schema VALUES (27);

CREATE TABLE genres(id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0));
CREATE TABLE genre_translations(
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  name TEXT NOT NULL CHECK(length(btrim(name)) > 0), PRIMARY KEY(genre_id,language)
);
CREATE TABLE books(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), author TEXT NOT NULL CHECK(length(btrim(author)) > 0),
  original_title TEXT NOT NULL CHECK(length(btrim(original_title)) > 0),
  original_language TEXT NOT NULL CHECK(length(original_language) BETWEEN 2 AND 35),
  position INTEGER NOT NULL UNIQUE CHECK(position > 0),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed')),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE book_links(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('amazon','goodreads')),
  url TEXT NOT NULL CHECK(url LIKE 'https://%' AND length(btrim(url)) > 8), PRIMARY KEY(book_id,platform)
);
CREATE TABLE book_translations(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0),
  description TEXT NOT NULL CHECK(length(btrim(description)) > 0), editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0),
  PRIMARY KEY(book_id,language)
);
CREATE TABLE book_genres(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, genre_id TEXT NOT NULL REFERENCES genres(id),
  PRIMARY KEY(book_id,genre_id)
);
CREATE INDEX book_genres_by_genre ON book_genres(genre_id,book_id);
CREATE TABLE users(
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL CHECK(length(btrim(display_name)) > 0),
  can_create_decks SMALLINT NOT NULL DEFAULT 0 CHECK(can_create_decks IN (0,1)), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);

CREATE TABLE accounts(
  user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL, time_zone TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('es','en','fr'))
);
CREATE TABLE reader_display_preferences (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  show_original_titles INTEGER NOT NULL CHECK(show_original_titles IN (0,1))
);
CREATE TABLE sessions(
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE TABLE auth_limits(bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at BIGINT NOT NULL);
CREATE TABLE decks(
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35), is_recommended SMALLINT NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(id,book_id)
);
CREATE INDEX decks_by_book ON decks(book_id);
CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;
CREATE TABLE deck_translations(
  deck_id TEXT NOT NULL REFERENCES decks(id), language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), description TEXT NOT NULL CHECK(length(btrim(description)) > 0),
  editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0), PRIMARY KEY(deck_id,language)
);
CREATE TABLE cards(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), deck_id TEXT NOT NULL, book_id TEXT NOT NULL, parent_id TEXT,
  position INTEGER NOT NULL CHECK(position > 0), is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)), created_at TIMESTAMPTZ, UNIQUE(id,deck_id),
  FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id),
  FOREIGN KEY(parent_id,deck_id) REFERENCES cards(id,deck_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX root_order ON cards(deck_id,position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(deck_id,parent_id,position) WHERE parent_id IS NOT NULL;
CREATE INDEX cards_by_deck ON cards(deck_id,parent_id,position);
CREATE INDEX cards_by_note_date ON cards(deck_id,created_at DESC) WHERE created_at IS NOT NULL;
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
  status TEXT NOT NULL CHECK(status IN ('unread','reading','read')), PRIMARY KEY(user_id,book_id)
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
  answer TEXT NOT NULL CHECK(answer IN ('soon','remembered')),
  answered_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,card_id)
);
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
CREATE TABLE practice_sessions(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK(topic IN ('reading','read','saved','mixed')),
  card_ids TEXT NOT NULL, card_index INTEGER NOT NULL DEFAULT 0 CHECK(card_index BETWEEN 0 AND 5),
  cost INTEGER NOT NULL CHECK(cost IN (2,3)), started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
  completed_local_day TEXT CHECK(completed_local_day IS NULL OR (completed_local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(completed_local_day,'YYYY-MM-DD'),'YYYY-MM-DD') = completed_local_day))
);
CREATE UNIQUE INDEX one_active_practice_session ON practice_sessions(user_id) WHERE completed_at IS NULL;
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

CREATE TABLE studies(rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), deck_id TEXT NOT NULL REFERENCES decks(id), PRIMARY KEY(user_id,deck_id));
CREATE TABLE deck_selections(
  user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id), deck_id TEXT NOT NULL,
  PRIMARY KEY(user_id,book_id), FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id)
);
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
  username TEXT NOT NULL, message TEXT NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND 5000),
  page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND 512),
  language TEXT NOT NULL CHECK(language IN ('es','en')), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX feedback_by_date ON feedback_submissions(created_at DESC);

CREATE FUNCTION reed_check_deck_author() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE((SELECT can_create_decks FROM users WHERE id=NEW.creator_user_id),0) <> 1 THEN
    RAISE EXCEPTION 'Deck creation permission required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_deck_author_insert BEFORE INSERT ON decks FOR EACH ROW EXECUTE FUNCTION reed_check_deck_author();
CREATE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id AND NOT (
    OLD.creator_user_id='reed-team' AND OLD.status='published' AND
    COALESCE((SELECT can_create_decks FROM users WHERE id=NEW.creator_user_id),0)=1
  )) OR NEW.book_id IS DISTINCT FROM OLD.book_id OR (NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'draft') THEN
    RAISE EXCEPTION 'Deck ownership is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_deck_owner BEFORE UPDATE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_deck_owner();
CREATE FUNCTION reed_keep_published_deck() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Published deck cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER keep_published_deck BEFORE DELETE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_published_deck();

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

CREATE FUNCTION reed_keep_published_card() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; cards cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION reed_keep_published_card();
CREATE FUNCTION reed_keep_published_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deck_status TEXT;
BEGIN
  SELECT d.status INTO deck_status FROM decks d JOIN cards c ON c.deck_id=d.id WHERE c.id=OLD.card_id;
  IF deck_status <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; card translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_card_translation_delete BEFORE DELETE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_keep_published_card_translation();
CREATE FUNCTION reed_keep_published_deck_translation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; deck translations cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER freeze_deck_translation_delete BEFORE DELETE ON deck_translations FOR EACH ROW EXECUTE FUNCTION reed_keep_published_deck_translation();
