// Schema v65 (SQLite) / v57 (PostgreSQL): interests.color is dropped.
// It predates chip_color and book_color; nothing reads it.

export const INTEREST_COLOR_REMOVAL_SQLITE="ALTER TABLE interests DROP COLUMN color;";
export const INTEREST_COLOR_REMOVAL_POSTGRES="ALTER TABLE public.interests DROP COLUMN color;";
