import type { Metadata } from "next";
import { ReportList } from "@/components/report/report-list";

export const metadata: Metadata = { title: "My reports" };

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">My reports</h1>
      <p className="mt-3 text-muted">Saved in this browser only. Sift keeps no database, so nobody else can see them and clearing site data removes them.</p>
      <div className="mt-8">
        <ReportList />
      </div>
    </main>
  );
}
