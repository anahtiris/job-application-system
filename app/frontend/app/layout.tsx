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
            __html: `(function(){var s=localStorage.getItem('theme'),m=window.matchMedia('(prefers-color-scheme: dark)');if(s==='dark'||(!s&&m.matches))document.documentElement.classList.add('dark');m.addEventListener('change',function(e){if(!localStorage.getItem('theme'))document.documentElement.classList.toggle('dark',e.matches);});var z={'large':'1.15','xl':'1.3'};var fs=localStorage.getItem('fontSize');if(fs&&z[fs])document.documentElement.style.zoom=z[fs];var ac=localStorage.getItem('accentColor');if(ac){document.documentElement.style.setProperty('--custom',ac);setTimeout(function(){var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="7" fill="'+ac+'"/><g transform="translate(7,7) scale(0.75)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></g></svg>';var link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';link.type='image/svg+xml';document.head.appendChild(link);}link.href='data:image/svg+xml,'+encodeURIComponent(svg);},0);}})();`,
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
