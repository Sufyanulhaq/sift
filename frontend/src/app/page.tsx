import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import { Pipeline } from "@/components/landing/pipeline";
import { Reveal } from "@/components/landing/reveal";

const FEATURES = [
  { title: "Topic map", body: "Every review drawn as a dot, placed by meaning with t SNE. Hover to read it, click a cluster to filter the whole report." },
  { title: "Negativity drivers", body: "See which topics produce the complaints, ranked by their share of all negative feedback." },
  { title: "Spike alerts", body: "A weekly chart per topic with unusual weeks marked, so a broken release shows up before the stars drop." },
  { title: "Search by meaning", body: "Ask for “refund taking forever” and get the reviews that mean it, whatever words they used." },
  { title: "Cited summary", body: "A plain English summary where every claim links to the review behind it. Hover a citation to read it." },
  { title: "Export anything", body: "Download reviews and topics as CSV, the full result as JSON, or print the report to PDF." },
];

const STACK = [
  { name: "Next.js 16 and React 19", role: "App Router frontend, server components for static pages" },
  { name: "FastAPI", role: "Async API with live progress over server sent events" },
  { name: "scikit learn", role: "Sentiment classifier, HDBSCAN, KMeans, t SNE, c TF IDF" },
  { name: "ONNX MiniLM", role: "Sentence embeddings on CPU, no GPU or paid API" },
  { name: "Claude", role: "Structured summaries with validated citations" },
  { name: "GSAP and Motion", role: "Timeline, scroll and layout animation" },
];

export default function Home() {
  return (
    <main>
      <Hero />

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 lg:grid-cols-4">
          {[
            ["82.7%", "sentiment accuracy on held out data"],
            ["20,000", "rows per upload"],
            ["0", "databases, accounts or trackers"],
            ["~10s", "for a thousand reviews"],
          ].map(([v, l], i) => (
            <Reveal key={l} delay={i * 0.08}>
              <p className="text-3xl font-semibold tracking-tight">{v}</p>
              <p className="mt-1 text-sm text-muted">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Pipeline />

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal>
          <p className="text-sm font-medium text-accent">What you get</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">A report your team will actually read.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className="card p-6 transition-transform hover:-translate-y-1">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-medium text-accent">Under the hood</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">No database. No paid hosting. Nothing stored.</h2>
            <p className="mt-4 text-muted">
              Files are analysed in memory and forgotten after 30 minutes. Reports are saved in your own browser with IndexedDB. The frontend runs on Vercel and
              the Python API in a free Docker space. The sentiment model is trained and evaluated in GitHub Actions on every change.
            </p>
            <Link href="/model" className="mt-6 inline-block text-sm font-medium text-accent underline underline-offset-4">
              Read the model card
            </Link>
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STACK.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.06} className="rounded-xl border border-line p-4">
                <p className="font-medium">{s.name}</p>
                <p className="mt-1 text-sm text-muted">{s.role}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Try it on 1,400 reviews right now.</h2>
          <p className="mt-4 text-muted">The demo opens instantly. Then run the same data through the live pipeline, or bring your own.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/report/sample" className="rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-card transition hover:brightness-110">
              Open the demo report
            </Link>
            <Link href="/analyze" className="rounded-xl border border-line px-6 py-3 font-medium transition hover:bg-surface-2">
              Run an analysis
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
