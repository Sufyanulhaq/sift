import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/ui/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sift: customer feedback intelligence", template: "%s · Sift" },
  description:
    "Upload reviews, survey answers or support tickets and get sentiment, topics, trends and a cited summary in seconds. No account, no database.",
};

// Runs before paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
        <footer className="no-print border-t border-line py-8 text-center text-sm text-muted">
          Sift is an open source portfolio project.{" "}
          <a className="underline underline-offset-4 hover:text-ink" href="https://github.com/Sufyanulhaq/sift">
            Read the code
          </a>
        </footer>
      </body>
    </html>
  );
}
