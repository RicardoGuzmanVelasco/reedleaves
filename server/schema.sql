CREATE TABLE genres (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0)
) STRICT;

CREATE TABLE genre_translations (
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  PRIMARY KEY(genre_id, language)
) STRICT;

CREATE TABLE books (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0),
  author TEXT NOT NULL CHECK(length(trim(author)) > 0),
  original_title TEXT NOT NULL CHECK(length(trim(original_title)) > 0),
  original_language TEXT NOT NULL CHECK(length(original_language) BETWEEN 2 AND 35),
  position INTEGER NOT NULL UNIQUE CHECK(position > 0),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft', 'reviewed')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE book_links (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('amazon', 'goodreads')),
  url TEXT NOT NULL CHECK(url LIKE 'https://%' AND length(trim(url)) > 8),
  PRIMARY KEY(book_id, platform)
) STRICT;

CREATE TABLE book_translations (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  short_title TEXT NOT NULL CHECK(length(trim(short_title)) > 0),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  editorial_note TEXT NOT NULL CHECK(length(trim(editorial_note)) > 0),
  PRIMARY KEY(book_id, language)
) STRICT;

CREATE TABLE book_genres (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_id TEXT NOT NULL REFERENCES genres(id),
  PRIMARY KEY(book_id, genre_id)
) STRICT;

CREATE INDEX book_genres_by_genre ON book_genres(genre_id, book_id);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) > 0),
  can_create_decks INTEGER NOT NULL DEFAULT 0 CHECK(can_create_decks IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);

CREATE TABLE accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('es','en','fr'))
) STRICT;
CREATE TABLE reader_display_preferences (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  show_original_titles INTEGER NOT NULL CHECK(show_original_titles IN (0,1))
) STRICT;
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE TABLE auth_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
) STRICT;

CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  is_recommended INTEGER NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id,book_id)
) STRICT;
CREATE INDEX decks_by_book ON decks(book_id);
CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;

CREATE TRIGGER check_deck_author_insert BEFORE INSERT ON decks WHEN COALESCE((SELECT can_create_decks FROM users WHERE id = NEW.creator_user_id),0) <> 1
BEGIN SELECT RAISE(ABORT,'Deck creation permission required'); END;
CREATE TRIGGER keep_deck_owner BEFORE UPDATE OF creator_user_id,book_id,language ON decks
WHEN NEW.creator_user_id IS NOT OLD.creator_user_id OR NEW.book_id <> OLD.book_id OR NEW.language <> OLD.language
BEGIN SELECT RAISE(ABORT,'Deck ownership is immutable'); END;

CREATE TABLE deck_versions (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deck_id,version),
  UNIQUE(id,book_id),
  FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id)
) STRICT;
CREATE TABLE deck_version_translations (
  version_id TEXT NOT NULL REFERENCES deck_versions(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  editorial_note TEXT NOT NULL CHECK(length(trim(editorial_note)) > 0),
  PRIMARY KEY(version_id,language)
) STRICT;

CREATE TABLE cards (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0),
  version_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  parent_id TEXT,
  position INTEGER NOT NULL CHECK(position > 0),
  is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)),
  created_at TEXT,
  UNIQUE(id,version_id),
  FOREIGN KEY(version_id,book_id) REFERENCES deck_versions(id,book_id),
  FOREIGN KEY(parent_id,version_id) REFERENCES cards(id,version_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(parent_id IS NULL OR parent_id <> id)
) STRICT;
CREATE UNIQUE INDEX root_order ON cards(version_id,position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(version_id,parent_id,position) WHERE parent_id IS NOT NULL;
CREATE INDEX cards_by_version ON cards(version_id,parent_id,position);
CREATE INDEX cards_by_note_date ON cards(version_id,created_at DESC) WHERE created_at IS NOT NULL;
CREATE TABLE card_translations (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  body TEXT NOT NULL CHECK(length(trim(body)) > 0),
  PRIMARY KEY(card_id,language)
) STRICT;

CREATE TRIGGER no_card_cycles_insert BEFORE INSERT ON cards WHEN NEW.parent_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'Card tree cycle') WHERE EXISTS (
    WITH RECURSIVE ancestors(id,parent_id) AS (
      SELECT id,parent_id FROM cards WHERE id = NEW.parent_id
      UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
CREATE TRIGGER no_card_cycles_update BEFORE UPDATE OF parent_id ON cards WHEN NEW.parent_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'Card tree cycle') WHERE EXISTS (
    WITH RECURSIVE ancestors(id,parent_id) AS (
      SELECT id,parent_id FROM cards WHERE id = NEW.parent_id
      UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;

CREATE TABLE deck_votes (
  user_id TEXT NOT NULL REFERENCES users(id),
  deck_id TEXT NOT NULL REFERENCES decks(id),
  value INTEGER NOT NULL CHECK(value IN (-1,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,deck_id)
) STRICT;
CREATE INDEX votes_by_deck ON deck_votes(deck_id,value);

CREATE TABLE card_votes (
  user_id TEXT NOT NULL REFERENCES users(id),
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK(value IN (-1,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,card_id)
) STRICT;
CREATE INDEX votes_by_card ON card_votes(card_id,value);

CREATE TABLE card_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  saved_at TEXT NOT NULL,
  PRIMARY KEY(user_id,card_id)
) STRICT;
CREATE INDEX saves_by_reader ON card_saves(user_id,saved_at,card_id);

CREATE TABLE book_reading (
  user_id TEXT NOT NULL REFERENCES users(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  status TEXT NOT NULL CHECK(status IN ('reading','read')),
  PRIMARY KEY(user_id,book_id)
) STRICT;
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  version_id TEXT NOT NULL REFERENCES deck_versions(id),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(user_id,version_id),
  UNIQUE(id,user_id,version_id),
  CHECK(completed_at IS NULL OR completed_at >= started_at)
) STRICT;
CREATE INDEX reviews_by_version ON reviews(version_id,user_id);
CREATE TABLE leaf_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991),
  last_accrual_day TEXT NOT NULL CHECK(
    last_accrual_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    date(last_accrual_day,'+0 days') IS last_accrual_day
  )
) STRICT;
CREATE TABLE petal_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991)
) STRICT;
CREATE TABLE review_cards (
  rowid INTEGER PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  local_day TEXT NOT NULL CHECK(local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(local_day,'+0 days') IS local_day),
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leaf_spent INTEGER NOT NULL DEFAULT 0 CHECK(leaf_spent IN (0,1)),
  UNIQUE(review_id,card_id),
  FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
  FOREIGN KEY(card_id,version_id) REFERENCES cards(id,version_id)
) STRICT;
CREATE INDEX review_cards_by_reader ON review_cards(user_id,version_id,rowid);

CREATE TABLE card_views (
  user_id TEXT NOT NULL REFERENCES users(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,card_id)
) STRICT;

CREATE TABLE studies (
  user_id TEXT NOT NULL REFERENCES users(id),
  version_id TEXT NOT NULL REFERENCES deck_versions(id),
  PRIMARY KEY(user_id,version_id)
) STRICT;
CREATE TABLE deck_selections (
  user_id TEXT NOT NULL REFERENCES users(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  version_id TEXT NOT NULL,
  PRIMARY KEY(user_id,book_id),
  FOREIGN KEY(version_id,book_id) REFERENCES deck_versions(id,book_id)
) STRICT;
CREATE TABLE review_positions (
  review_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
  FOREIGN KEY(review_id,card_id) REFERENCES review_cards(review_id,card_id)
) STRICT;
CREATE TABLE daily_ideas (
  day TEXT NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id),
  PRIMARY KEY(day)
) STRICT;

CREATE TABLE feedback_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 5000),
  page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND 512),
  language TEXT NOT NULL CHECK(language IN ('es','en')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX feedback_by_date ON feedback_submissions(created_at DESC);

CREATE TRIGGER complete_review AFTER INSERT ON review_cards BEGIN
  UPDATE reviews SET completed_at = COALESCE(completed_at,CURRENT_TIMESTAMP)
  WHERE id = NEW.review_id AND
    (SELECT count(*) FROM review_cards WHERE review_id = NEW.review_id) =
    (SELECT count(*) FROM cards WHERE version_id = NEW.version_id);
END;

CREATE TRIGGER freeze_cards_insert BEFORE INSERT ON cards
WHEN (SELECT status FROM deck_versions WHERE id = NEW.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_cards_update BEFORE UPDATE ON cards
WHEN (SELECT status FROM deck_versions WHERE id = OLD.version_id) <> 'draft' OR (SELECT status FROM deck_versions WHERE id = NEW.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards
WHEN (SELECT status FROM deck_versions WHERE id = OLD.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_card_translations_insert BEFORE INSERT ON card_translations
WHEN (SELECT status FROM deck_versions WHERE id = (SELECT version_id FROM cards WHERE id = NEW.card_id)) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_card_translations_update BEFORE UPDATE ON card_translations
WHEN (SELECT status FROM deck_versions WHERE id = (SELECT version_id FROM cards WHERE id = OLD.card_id)) <> 'draft' OR (SELECT status FROM deck_versions WHERE id = (SELECT version_id FROM cards WHERE id = NEW.card_id)) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_card_translations_delete BEFORE DELETE ON card_translations
WHEN (SELECT status FROM deck_versions WHERE id = (SELECT version_id FROM cards WHERE id = OLD.card_id)) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_deck_version_translations_insert BEFORE INSERT ON deck_version_translations
WHEN (SELECT status FROM deck_versions WHERE id = NEW.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_deck_version_translations_update BEFORE UPDATE ON deck_version_translations
WHEN (SELECT status FROM deck_versions WHERE id = OLD.version_id) <> 'draft' OR (SELECT status FROM deck_versions WHERE id = NEW.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_deck_version_translations_delete BEFORE DELETE ON deck_version_translations
WHEN (SELECT status FROM deck_versions WHERE id = OLD.version_id) <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published content is immutable; create a new version'); END;

CREATE TRIGGER freeze_version BEFORE UPDATE ON deck_versions
WHEN OLD.status <> 'draft' AND (NEW.id <> OLD.id OR NEW.deck_id <> OLD.deck_id OR NEW.book_id <> OLD.book_id OR NEW.version <> OLD.version OR NEW.status = 'draft' OR NEW.editorial_status <> OLD.editorial_status OR NEW.created_at <> OLD.created_at)
BEGIN SELECT RAISE(ABORT,'Published version is immutable'); END;
CREATE TRIGGER keep_published_version BEFORE DELETE ON deck_versions WHEN OLD.status <> 'draft'
BEGIN SELECT RAISE(ABORT,'Published version is immutable'); END;
PRAGMA user_version = 22;
