// Fast drop-in for make.fun's csv-reader 1.0.0: reads a broken CSV text exactly
// as the reference does, and answers {columns, rows, errors} for one case's
// input {text, header}. Same policy as the reference, different machinery:
// the reference walks one character at a time and grows every field a
// character at a time; this one jumps with indexOf, cuts fields out with
// slice, and only builds a string piece by piece where a field is really
// broken (a doubled quote, a line break inside quotes, a stray CR). Pure:
// no clock, no randomness, no state kept from one call to the next.
//
// Policy (the reference's, restated):
// - a U+FEFF at the very start of the text is dropped;
// - a record ends at LF or CRLF, and a line left with no characters is no record;
// - outside a quoted field a CR not followed by LF is dropped (stray_cr);
// - a field that opens with a quote runs to the next quote that is not doubled,
//   "" inside it one quote, each CRLF or lone CR inside it read as LF; what
//   follows its closing quote, up to the next comma or line break, is appended
//   as it stands (quote_junk, when the field ends); a quote that never closes
//   is a literal character, and the text after it is read again as unquoted
//   (unterminated_quote);
// - a quote inside an unquoted field is a literal character; fields stay
//   strings, never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds the
//   records after it (every record when header is false), each padded with ""
//   (short_row, with fields: its count) or cut (long_row, with extra: the cut
//   fields) to the first record's width;
// - each error is {code, line, row}: line the 1-based line its record starts
//   on, row its record's index in rows (null for the header), in the order
//   met, a record's short_row or long_row when the record ends.
//
// The field readers write their result into fValue/fEnded/fAdded instead of
// returning a fresh object per field: a set holds about a million fields, and
// a million small objects is time the clock does not forgive.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Every error of a record names these two.
  let recordLine = 1;
  let recordRow = null;

  // The last field read: its value, how it ended, and how many characters
  // the unquoted scan that read it kept (the quote_junk test reads this).
  let fValue = '';
  let fEnded = COMMA;
  let fAdded = 0;

  // The next comma, CR or LF at or after a position, as one native scan.
  const DELIM = /[,\r\n]/g;

  // Reads unquoted characters onto `value` up to the next comma or line
  // break: a CR not followed by LF is dropped (stray_cr).
  function readUnquoted(value) {
    let added = 0;
    let seg = pos; // start of the current clean run
    for (;;) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        // no delimiter left: the field runs to the end of the text
        if (seg < n) {
          value += text.slice(seg, n);
          added += n - seg;
        }
        pos = n;
        fValue = value;
        fEnded = END;
        fAdded = added;
        return;
      }
      const d = m.index;
      const c = m[0];
      if (c === ',') {
        if (seg < d) {
          value += text.slice(seg, d);
          added += d - seg;
        }
        pos = d + 1;
        fValue = value;
        fEnded = COMMA;
        fAdded = added;
        return;
      }
      if (c === '\n') {
        if (seg < d) {
          value += text.slice(seg, d);
          added += d - seg;
        }
        pos = d + 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      // a CR: CRLF ends the record, a lone CR is dropped with an error
      if (text.charCodeAt(d + 1) === 10) {
        if (seg < d) {
          value += text.slice(seg, d);
          added += d - seg;
        }
        pos = d + 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      if (seg < d) {
        value += text.slice(seg, d);
        added += d - seg;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = d + 1;
      seg = pos;
    }
  }

  // Builds the value of a quoted span [start, q): doubled quotes become one
  // quote, each CRLF or lone CR becomes one LF, and `line` counts every line
  // break inside it. Only used when the span really holds one of those.
  function buildQuoted(start, q) {
    let value = '';
    let seg = start;
    let i = start;
    while (i < q) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        // a doubled quote: one quote in the value
        value += text.slice(seg, i);
        value += '"';
        i += 2;
        seg = i;
      } else if (c === 13) {
        // CRLF or a lone CR inside quotes: one LF
        value += text.slice(seg, i);
        value += '\n';
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        seg = i;
      } else if (c === 10) {
        value += text.slice(seg, i);
        value += '\n';
        line += 1;
        i += 1;
        seg = i;
      } else {
        i += 1;
      }
    }
    if (seg < q) value += text.slice(seg, q);
    return value;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote: the next quote that is not doubled.
    let q = text.indexOf('"', pos + 1);
    let escaped = false;
    while (q !== -1 && text.charCodeAt(q + 1) === 34) {
      escaped = true;
      q = text.indexOf('"', q + 2);
    }
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    const start = pos + 1;
    let value;
    if (!escaped) {
      // No doubled quote: the value is the span itself, unless a line break
      // sits inside it.
      let special = false;
      for (let i = start; i < q; i++) {
        const c = text.charCodeAt(i);
        if (c === 10 || c === 13) {
          special = true;
          break;
        }
      }
      value = special ? buildQuoted(start, q) : text.slice(start, q);
    } else {
      value = buildQuoted(start, q);
    }
    pos = q + 1;
    if (pos >= n) {
      fValue = value;
      fEnded = END;
      fAdded = 0;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA;
      fAdded = 0;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (pos < n) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
