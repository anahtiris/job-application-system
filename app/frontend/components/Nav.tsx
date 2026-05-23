"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Applications" },
  { href: "/setup", label: "Resume Setup" },
  { href: "/skills", label: "Skills" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between w-full">
        <Link href="/" className="font-serif text-base tracking-tight hover:text-primary transition-colors" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
          Job Applications
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors
                ${path === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
