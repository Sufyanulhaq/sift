export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;

export const int = (v: number) => v.toLocaleString("en");

export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

/** Ten topic colours that stay readable on light and dark backgrounds. */
export const TOPIC_COLORS = [
  "rgb(99 102 241)",
  "rgb(14 165 233)",
  "rgb(16 185 129)",
  "rgb(245 158 11)",
  "rgb(236 72 153)",
  "rgb(139 92 246)",
  "rgb(20 184 166)",
  "rgb(249 115 22)",
  "rgb(132 204 22)",
  "rgb(244 63 94)",
];

export const topicColor = (id: number) => (id < 0 ? "rgb(148 163 184)" : TOPIC_COLORS[id % TOPIC_COLORS.length]);

export function sentimentColor(v: number) {
  if (v > 0.2) return "rgb(16 185 129)";
  if (v < -0.2) return "rgb(244 63 94)";
  return "rgb(148 163 184)";
}
