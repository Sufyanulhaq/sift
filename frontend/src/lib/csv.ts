/** A small CSV reader for previewing a file before upload. The server does the real parsing. */
export function parseCsv(text: string, maxRows = Infinity): string[][] {
  const delimiter = sniff(text.slice(0, 4000));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      if (rows.length >= maxRows) return rows;
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function sniff(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const counts = [",", ";", "\t", "|"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

const TEXT_HINTS = ["review", "text", "comment", "feedback", "body", "message", "content", "response", "answer"];
const DATE_HINTS = ["date", "time", "created", "submitted", "posted"];
const RATING_HINTS = ["rating", "score", "stars", "nps", "csat"];

/** Guesses like the server does, so the picker starts on the likely answer. */
export function guessColumns(rows: string[][]) {
  const [header = [], ...body] = rows;
  const avg = (i: number) => body.reduce((n, r) => n + (r[i]?.length ?? 0), 0) / Math.max(1, body.length);
  const pick = (hints: string[]) => header.filter((h) => hints.some((k) => h.toLowerCase().includes(k)));
  const byLength = (names: string[]) => [...names].sort((a, b) => avg(header.indexOf(b)) - avg(header.indexOf(a)))[0];
  const text = byLength(pick(TEXT_HINTS)) ?? byLength(header);
  const date = pick(DATE_HINTS)[0];
  const rating = pick(RATING_HINTS)[0];
  return { text, date, rating };
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
