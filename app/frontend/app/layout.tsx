import type { Metadata } from "next";
import { Geist_Mono, Playfair_Display, Syne } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "sonner";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Job Applications",
  description: "Job application tracker and document generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${playfair.variable} ${syne.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Apply .dark class based on OS preference — runs before paint to avoid flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('theme'),m=window.matchMedia('(prefers-color-scheme: dark)');if(s==='dark'||(!s&&m.matches))document.documentElement.classList.add('dark');m.addEventListener('change',function(e){if(!localStorage.getItem('theme'))document.documentElement.classList.toggle('dark',e.matches);});var z={'large':'1.15','xl':'1.3'};var fs=localStorage.getItem('fontSize');if(fs&&z[fs])document.documentElement.style.zoom=z[fs];var ac=localStorage.getItem('accentColor');if(ac)document.documentElement.style.setProperty('--custom',ac);})();`,
          }}
        />
      </head>
      <body className="h-full">
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
