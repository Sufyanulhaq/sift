import type { Metadata } from "next";
import model from "@/data/model.json";

export const metadata: Metadata = { title: "Model card" };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ModelPage() {
  const rows = [
    { name: "Sift classifier", ...model.test },
    { ...model.baseline, name: model.baseline.name },
  ];
  const [[tn, fp], [fn, tp]] = model.test.confusion;
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-12 sm:px-6">
      <header>
        <p className="text-sm font-medium text-accent">Model card</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">How Sift scores sentiment</h1>
        <p className="mt-4 text-muted">
          A {model.algorithm.toLowerCase()} trained on {model.data.rows.toLocaleString("en")} labelled sentences from Amazon, IMDb and Yelp. It is retrained in
          GitHub Actions whenever the training script changes, and the numbers below come straight from that run on {model.data.test} sentences it never saw.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Test accuracy", value: pct(model.test.accuracy) },
          { label: "Test F1", value: pct(model.test.f1) },
          { label: "Cross validated F1", value: pct(model.crossValidationF1) },
          { label: "Gain over VADER", value: `+${((model.test.accuracy - model.baseline.accuracy) * 100).toFixed(1)} pts` },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-x-auto p-6">
        <h2 className="font-semibold">Against the rule based baseline</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">Model</th>
              <th className="py-2 font-medium">Accuracy</th>
              <th className="py-2 font-medium">Negative recall</th>
              <th className="py-2 font-medium">Positive recall</th>
              <th className="py-2 font-medium">Amazon</th>
              <th className="py-2 font-medium">IMDb</th>
              <th className="py-2 font-medium">Yelp</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="py-2.5 pr-4">{r.name}</td>
                <td>{pct(r.accuracy)}</td>
                <td>{pct(r.perClass.negative.recall)}</td>
                <td>{pct(r.perClass.positive.recall)}</td>
                <td>{pct(r.bySource.amazon)}</td>
                <td>{pct(r.bySource.imdb)}</td>
                <td>{pct(r.bySource.yelp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm text-muted">
          VADER finds only {pct(model.baseline.perClass.negative.recall)} of negative sentences. For a tool meant to surface complaints, that is the number that matters,
          and the trained model finds {pct(model.test.perClass.negative.recall)}.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Confusion matrix</h2>
          <div className="mt-4 grid grid-cols-[auto_1fr_1fr] gap-1.5 text-sm tabular-nums">
            <span />
            <span className="text-center text-xs text-muted">Predicted negative</span>
            <span className="text-center text-xs text-muted">Predicted positive</span>
            <span className="self-center pr-2 text-xs text-muted">Negative</span>
            <Cell value={tn} good />
            <Cell value={fp} />
            <span className="self-center pr-2 text-xs text-muted">Positive</span>
            <Cell value={fn} />
            <Cell value={tp} good />
          </div>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Training</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Version", model.version],
              ["Regularisation C", `${model.chosenC}, picked by 5 fold grid search`],
              ["Split", `${model.data.train} train, ${model.data.test} test, stratified`],
              ["Training time", `${model.seconds}s on a GitHub runner`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold">Where it goes wrong</h2>
        <p className="mt-1 text-sm text-muted">The test sentences it was most confident about and still got wrong.</p>
        <ul className="mt-4 space-y-3 text-sm">
          {model.mistakes.slice(0, 6).map((m) => (
            <li key={m.text} className="flex gap-3">
              <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs ${m.label ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                {m.label ? "positive" : "negative"}
              </span>
              <span>
                “{m.text}” <span className="text-muted">was called {m.label ? "negative" : "positive"} with {pct(m.confidence)} confidence</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Limitations</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {model.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="text-sm text-muted">
        <h2 className="font-semibold text-ink">Data</h2>
        <p className="mt-2">
          {model.data.name}, {model.data.source}, licensed {model.data.license}. {model.data.citation}{" "}
          <a href={model.data.url} className="underline underline-offset-4 hover:text-ink">
            Dataset page
          </a>
        </p>
        <h2 className="mt-6 font-semibold text-ink">The rest of the pipeline</h2>
        <p className="mt-2">
          Meaning comes from the all MiniLM L6 v2 sentence model run through ONNX, with a TF IDF and SVD fallback. Topics come from HDBSCAN, or KMeans picked by
          silhouette score, with near duplicate topics merged by centroid similarity and named by class based TF IDF. Spikes are weeks more than 2.5 standard
          deviations above the previous eight. Summaries are written by Claude when a key is set and every citation is checked against the reviews it was shown.
        </p>
      </section>
    </main>
  );
}

function Cell({ value, good }: { value: number; good?: boolean }) {
  return <span className={`rounded-lg py-4 text-center text-lg font-semibold ${good ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>{value}</span>;
}
