// Editorial corrections approved with the popular-title model. Bind titles:
// PostgreSQL's SQLite-style placeholder adapter also sees literal question marks.
const preferredTitles=[
  ["Getting Things Done","David Allen","Organízate con eficacia",""],
  ["Tidy First?","Kent Beck","¿Primero ordenado?",""],
  ["Turn the Ship Around!","L. David Marquet","¡Cambia el barco de rumbo!",""],
  ["Fearless Salary Negotiation","Josh Doody","Fearless Salary Negotiation",""],
  ["Invierte en ti","Natalia de Santiago","Invierte en ti",""],
  ["Invierte con poco","Natalia de Santiago","Invierte con poco",""],
  ["CASHFLOW Quadrant","Robert T. Kiyosaki","El cuadrante del flujo del dinero","El cuadrante del flujo de dinero"],
  ["The Almanack of Naval Ravikant","Eric Jorgenson","El Almanaque de Naval Ravikant","El almanaque de Naval Ravikant"],
  ["As a Man Thinketh","James Allen","Como un hombre piensa así es su vida","Como un hombre piensa, así es su vida"],
  ["Omgiven av idioter","Thomas Erikson","Rodeados de idiotas",""]
];

export const POPULAR_TITLE_RENAME_SQL=`
  ALTER TABLE books RENAME COLUMN original_title TO popular_title;
  ALTER TABLE books RENAME COLUMN original_language TO popular_language;
`;

export const POPULAR_TITLE_UPDATES=[
  ...preferredTitles.map(([title,author,previous,next])=>({
    sql:`UPDATE book_translations SET title=? WHERE language='es' AND title=? AND book_id IN (
      SELECT id FROM books WHERE popular_title=? AND lower(trim(author))=lower(?))`,
    values:[next,previous,title,author]
  })),
  {sql:"UPDATE books SET popular_title=?,popular_language='en' WHERE popular_title=? AND lower(trim(author))=lower(?)",
    values:["Surrounded by Idiots","Omgiven av idioter","Thomas Erikson"]},
  {sql:"UPDATE books SET popular_language='en' WHERE popular_title=? AND lower(trim(author))=lower(?) AND popular_language='es'",
    values:["Influence","Robert B. Cialdini"]},
  {sql:"UPDATE books SET popular_language='en' WHERE popular_title=? AND lower(trim(author)) IN (lower(?),lower(?)) AND popular_language='es'",
    values:["Reality Transurfing Steps I-V","Vadim Zeeland","Vadim Zeland"]}
];
