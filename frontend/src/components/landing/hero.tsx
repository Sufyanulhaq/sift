"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useRef } from "react";
import { HeroDots } from "./hero-dots";

gsap.registerPlugin(useGSAP);

const HEADLINE = ["Hear", "what", "thousands", "of", "customers", "are", "actually", "saying."];

export function Hero() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-badge", { y: 12, opacity: 0, duration: 0.5 })
        .from(".hero-word", { yPercent: 110, duration: 0.8, stagger: 0.05 }, "-=0.2")
        .from(".hero-sub", { y: 16, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".hero-cta", { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.3")
        .from(".hero-visual", { opacity: 0, scale: 0.96, duration: 1 }, "-=0.6");
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden">
      <div className="grid-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <div>
          <p className="hero-badge inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-positive" />
            Free, open source, no account
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {HEADLINE.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                <span className={`hero-word inline-block ${w === "actually" ? "text-accent" : ""}`}>{w}</span>
                {i < HEADLINE.length - 1 && " "}
              </span>
            ))}
          </h1>
          <p className="hero-sub mt-6 max-w-xl text-lg text-muted">
            Drop in reviews, survey answers or support tickets. Sift scores the mood of every one, groups them into topics by meaning, spots the week something
            broke and writes a summary you can check line by line.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/report/sample" className="hero-cta rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-card transition hover:brightness-110">
              See the live demo
            </Link>
            <Link href="/analyze" className="hero-cta rounded-xl border border-line bg-surface px-6 py-3 font-medium transition hover:bg-surface-2">
              Analyse your own data
            </Link>
          </div>
        </div>
        <div className="hero-visual card aspect-square w-full max-w-lg justify-self-center p-4 lg:justify-self-end">
          <HeroDots />
        </div>
      </div>
    </section>
  );
}
