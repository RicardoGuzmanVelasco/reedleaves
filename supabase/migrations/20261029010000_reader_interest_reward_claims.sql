BEGIN;

ALTER TABLE reader_interest_settings ADD COLUMN initial_submission_at TIMESTAMPTZ;

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
REVOKE ALL PRIVILEGES ON TABLE reader_interest_reward_claims FROM anon,authenticated;

COMMIT;
