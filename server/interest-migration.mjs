// Add the requested interests without replacing existing labels or other books' choices.
export const INTEREST_MIGRATION_SQL=`
  INSERT INTO genres(id) VALUES ('software'),('mindfulness') ON CONFLICT(id) DO NOTHING;
  INSERT INTO genre_translations(genre_id,language,name) VALUES
    ('software','es','Software'),('software','en','Software'),
    ('mindfulness','es','Mindfulness'),('mindfulness','en','Mindfulness')
    ON CONFLICT(genre_id,language) DO NOTHING;
`;

export const SOFTWARE_BOOK_IDENTITY=["Tidy First?","Kent Beck"];
export const SOFTWARE_RECLASSIFICATION_QUERIES=[
  `DELETE FROM book_genres WHERE genre_id IN ('personal-growth','productivity') AND book_id IN (
    SELECT id FROM books WHERE lower(trim(original_title))=lower(?) AND lower(trim(author))=lower(?))`,
  `INSERT INTO book_genres(book_id,genre_id) SELECT id,'software' FROM books
    WHERE lower(trim(original_title))=lower(?) AND lower(trim(author))=lower(?)
    ON CONFLICT(book_id,genre_id) DO NOTHING`
];
