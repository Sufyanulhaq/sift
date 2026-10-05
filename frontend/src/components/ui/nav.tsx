"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/analyze", label: "Analyse" },
  { href: "/report/sample", label: "Demo" },
  { href: "/reports", label: "My reports" },
  { href: "/model", label: "Model" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          Sift
        </Link>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--accent)" />
      <path d="M6 8h12M8 12h8M10.5 16h3" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
