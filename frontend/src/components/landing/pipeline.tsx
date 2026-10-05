"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEPS = [
  { title: "Clean", body: "Finds the text, date and rating columns on its own, drops empty rows and duplicates, and copes with any delimiter or encoding." },
  { title: "Score the mood", body: "A logistic regression classifier trained on 2,400 labelled sentences, 10 points more accurate than the usual rule based VADER." },
  { title: "Understand meaning", body: "Each review becomes a 384 number vector from the MiniLM sentence model, so “arrived late” and “took three weeks” land side by side." },
  { title: "Find topics", body: "HDBSCAN clusters the vectors, near duplicates are merged, and class based TF IDF picks words that set each topic apart." },
  { title: "Catch spikes", body: "Weekly counts per topic are tested against the previous eight weeks. Anything 2.5 deviations above normal is flagged." },
  { title: "Explain it", body: "Claude writes a short summary that cites real reviews. Every citation is checked, and an offline writer takes over if there is no key." },
];

export function Pipeline() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap.fromTo(
        ".pipe-line",
        { scaleY: 0 },
        { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".pipe-list", start: "top 70%", end: "bottom 60%", scrub: true } },
      );
      gsap.utils.toArray<HTMLElement>(".pipe-step").forEach((el) => {
        gsap.from(el, { opacity: 0.15, x: 24, duration: 0.6, scrollTrigger: { trigger: el, start: "top 75%", toggleActions: "play none none reverse" } });
        gsap.from(el.querySelector(".pipe-dot"), { scale: 0, duration: 0.4, ease: "back.out(3)", scrollTrigger: { trigger: el, start: "top 75%", toggleActions: "play none none reverse" } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <p className="text-sm font-medium text-accent">How it works</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Six steps of real machine learning, streamed to you live.</h2>
      <ol className="pipe-list relative mt-14 space-y-12 pl-10">
        <span className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-0.5 bg-line" />
        <span className="pipe-line absolute left-[11px] top-2 h-[calc(100%-1rem)] w-0.5 origin-top bg-accent" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="pipe-step relative">
            <span className="pipe-dot absolute -left-10 top-0.5 grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-white">{i + 1}</span>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 max-w-xl text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
