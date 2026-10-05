import type { JobEvent, Result, Step } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface Started {
  jobId: string;
  steps: Step[];
  notes: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("The analysis server could not be reached. It may be waking up, so try again in a moment.", 0);
  }
  if (!res.ok) {
    let message = `The server answered with ${res.status}.`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export function health() {
  return call<{ ok: boolean; sentimentModel: string; summary: "claude" | "offline" }>("/api/health");
}

export function samples() {
  return call<{ samples: string[] }>("/api/samples");
}

export function modelCard() {
  return call<{ name: string; info: Record<string, unknown> | null }>("/api/model");
}

export function analyzeSample(name: string) {
  return call<Started>(`/api/analyze/sample/${encodeURIComponent(name)}`, { method: "POST" });
}

export function analyzeTexts(texts: string[]) {
  return call<Started>("/api/analyze/texts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
}

export function analyzeFile(file: File, columns: { text?: string; date?: string; rating?: string }) {
  const form = new FormData();
  form.append("file", file);
  if (columns.text) form.append("text_column", columns.text);
  if (columns.date) form.append("date_column", columns.date);
  if (columns.rating) form.append("rating_column", columns.rating);
  return call<Started>("/api/analyze", { method: "POST", body: form });
}

export function result(jobId: string) {
  return call<Result>(`/api/jobs/${jobId}`);
}

export function search(jobId: string, query: string, limit = 20) {
  return call<{ query: string; results: { id: number; score: number }[] }>(`/api/jobs/${jobId}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
}

/** Follows the job's server sent events. Returns a function that stops listening. */
export function follow(jobId: string, onEvent: (event: JobEvent) => void, onLost: () => void): () => void {
  const source = new EventSource(`${API_URL}/api/jobs/${jobId}/events`);
  let finished = false;
  source.onmessage = (message) => {
    const event = JSON.parse(message.data) as JobEvent;
    if (event.type !== "step") {
      finished = true;
      source.close();
    }
    onEvent(event);
  };
  source.onerror = () => {
    if (finished) return;
    source.close();
    onLost();
  };
  return () => {
    finished = true;
    source.close();
  };
}
