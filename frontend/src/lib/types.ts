export type Label = "positive" | "negative" | "neutral";

export interface Meta {
  rows: number;
  columns: string[];
  textColumn: string;
  dateColumn: string | null;
  ratingColumn: string | null;
  duplicatesRemoved: number;
  emptyRemoved: number;
  notes: string[];
  sentimentModel: string;
  embedder: string;
  clustering: string;
  summaryMode: "offline" | "claude" | "offline_fallback";
  seconds: number;
}

export interface Overview {
  sentiment: number;
  positive: number;
  negative: number;
  neutral: number;
  ratingAgreement: number | null;
  unassigned: number;
}

export interface Topic {
  id: number;
  name: string;
  keywords: string[];
  size: number;
  share: number;
  sentiment: number;
  negativeShare: number;
  examples: number[];
}

export interface Driver {
  topic: number;
  negative: number;
  share: number;
}

export interface Spike {
  topic: number;
  week: string;
  count: number;
  usual: number;
}

export interface Trends {
  weeks: string[];
  series: Record<string, number[]>;
  sentiment: number[];
  spikes: Spike[];
}

export interface Review {
  id: number;
  text: string;
  date: string | null;
  rating: number | null;
  sentiment: number;
  label: Label;
  topic: number;
  x: number;
  y: number;
}

export interface Result {
  meta: Meta;
  overview: Overview;
  summary: { text: string; citations: number[] };
  topics: Topic[];
  drivers: Driver[];
  trends: Trends | null;
  reviews: Review[];
}

export interface StoredReport {
  id: string;
  name: string;
  createdAt: number;
  /** The server job, kept so semantic search works while the server still holds it. */
  jobId: string | null;
  result: Result;
}

export interface Step {
  id: string;
  label: string;
}

export type JobEvent =
  | { type: "step"; step: string; status: "running" | "done"; detail: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };
