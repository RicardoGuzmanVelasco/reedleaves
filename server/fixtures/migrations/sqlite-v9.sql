-- Historical schema: db659af:server/schema.sql. Keep immutable.
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

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  UNIQUE(book_id, url),
  UNIQUE(id, book_id)
) STRICT;


CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) > 0),
  can_create_decks INTEGER NOT NULL DEFAULT 0 CHECK(can_create_decks IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('es','en','fr'))
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
  source_id TEXT NOT NULL,
  UNIQUE(id,version_id),
  FOREIGN KEY(version_id,book_id) REFERENCES deck_versions(id,book_id),
  FOREIGN KEY(parent_id,version_id) REFERENCES cards(id,version_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(source_id,book_id) REFERENCES sources(id,book_id),
  CHECK(parent_id IS NULL OR parent_id <> id)
) STRICT;
CREATE UNIQUE INDEX root_order ON cards(version_id,position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(version_id,parent_id,position) WHERE parent_id IS NOT NULL;
CREATE INDEX cards_by_version ON cards(version_id,parent_id,position);
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
  balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND 3),
  last_accrual_day TEXT NOT NULL CHECK(
    last_accrual_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    date(last_accrual_day,'+0 days') IS last_accrual_day
  )
) STRICT;
CREATE TABLE review_unlocks (
  review_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  local_day TEXT NOT NULL CHECK(local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(local_day,'+0 days') IS local_day),
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(review_id,card_id),
  FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
  FOREIGN KEY(card_id,version_id) REFERENCES cards(id,version_id)
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
  FOREIGN KEY(review_id,card_id) REFERENCES review_unlocks(review_id,card_id)
) STRICT;
CREATE TABLE reader_filters (
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL CHECK(source IN ('reading','read','reviewing','reviewed','interests','all')),
  PRIMARY KEY(user_id,source)
) STRICT;
CREATE TABLE reader_interests (
  user_id TEXT NOT NULL REFERENCES users(id),
  genre_id TEXT NOT NULL REFERENCES genres(id),
  PRIMARY KEY(user_id,genre_id)
) STRICT;
CREATE TABLE daily_ideas (
  user_id TEXT NOT NULL REFERENCES users(id),
  local_day TEXT NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id),
  PRIMARY KEY(user_id,local_day)
) STRICT;

CREATE TRIGGER check_unlock_path BEFORE INSERT ON review_unlocks BEGIN
  SELECT RAISE(ABORT,'Parent card is locked') WHERE EXISTS (
    SELECT 1 FROM cards c WHERE c.id = NEW.card_id AND c.version_id = NEW.version_id
    AND c.parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM review_unlocks u WHERE u.review_id = NEW.review_id AND u.card_id = c.parent_id
    )
  );
  SELECT RAISE(ABORT,'Previous sibling is locked') WHERE EXISTS (
    SELECT 1 FROM cards c JOIN cards sibling ON sibling.version_id = c.version_id
      AND sibling.parent_id IS c.parent_id AND sibling.position < c.position
    WHERE c.id = NEW.card_id AND c.version_id = NEW.version_id AND NOT EXISTS (
      SELECT 1 FROM review_unlocks u WHERE u.review_id = NEW.review_id AND u.card_id = sibling.id
    )
  );
END;
CREATE TRIGGER complete_review AFTER INSERT ON review_unlocks BEGIN
  UPDATE reviews SET completed_at = COALESCE(completed_at,CURRENT_TIMESTAMP)
  WHERE id = NEW.review_id AND
    (SELECT count(*) FROM review_unlocks WHERE review_id = NEW.review_id) =
    (SELECT count(*) FROM cards WHERE version_id = NEW.version_id);
END;

-- Grant elapsed calendar days (capped), then spend in the same statement.
-- A duplicate or invalid unlock rolls back the wallet changes as well.
CREATE TRIGGER spend_unlock_leaf BEFORE INSERT ON review_unlocks BEGIN
  INSERT INTO leaf_wallets(user_id,balance,last_accrual_day)
    VALUES (NEW.user_id,1,NEW.local_day)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = min(3,leaf_wallets.balance + CAST(julianday(NEW.local_day) - julianday(leaf_wallets.last_accrual_day) AS INTEGER)),
      last_accrual_day = NEW.local_day
    WHERE NEW.local_day > leaf_wallets.last_accrual_day;
  UPDATE leaf_wallets SET balance = balance - 1
    WHERE user_id = NEW.user_id AND balance > 0 AND last_accrual_day <= NEW.local_day;
  SELECT RAISE(ABORT,'No leaves available') WHERE changes() <> 1;
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
PRAGMA user_version = 9;
