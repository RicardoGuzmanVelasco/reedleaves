// Small RFC 4180 reader: quoted commas, escaped quotes, CRLF and multiline text.
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error("Unexpected quote in CSV");
      quoted = true;
    } else if (c === ",") {
      row.push(cell); cell = ""; closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(value => value.length)) rows.push(row);
      row = []; cell = ""; closed = false;
    } else {
      if (closed) throw new Error("Unexpected text after a CSV quote");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(cell);
  if (row.some(value => value.length)) rows.push(row);
  const headers = rows.shift();
  if (!headers?.length || headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error("Invalid CSV header");
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2}: incorrect column count`);
    return Object.fromEntries(headers.map((header, j) => [header, values[j]]));
  });
}
