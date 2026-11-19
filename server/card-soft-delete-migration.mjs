// Soft delete of notes: a deleted card keeps its row (saves, votes, views and practice keep their reference)
// and leaves the sibling order, so the unique order indexes only cover the cards that are not deleted.
const ORDER_INDEXES=`DROP INDEX root_order;
DROP INDEX sibling_order;
CREATE UNIQUE INDEX root_order ON cards(deck_id,position) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(deck_id,parent_id,position) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;`;

export const CARD_SOFT_DELETE_SQLITE=`ALTER TABLE cards ADD COLUMN deleted_at TEXT;
${ORDER_INDEXES}`;

export const CARD_SOFT_DELETE_POSTGRES=`ALTER TABLE cards ADD COLUMN deleted_at TIMESTAMPTZ;
${ORDER_INDEXES}`;
