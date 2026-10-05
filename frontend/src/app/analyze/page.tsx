import type { Metadata } from "next";
import { Analyzer } from "@/components/analyze/analyzer";

export const metadata: Metadata = { title: "Analyse feedback" };

export default function AnalyzePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Analyse feedback</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Upload a CSV of reviews, survey answers or support tickets, or paste them in. Sift reads every row, scores the mood, groups it into topics and
        tells you what changed. Your file is analysed in memory and the report is saved only in this browser.
      </p>
      <div className="mt-10">
        <Analyzer />
      </div>
    </main>
  );
}
