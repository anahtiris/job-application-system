"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, FileUser, Brain, Settings, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hasInterview, setHasInterview] = useState(false);

  useEffect(() => {
    api
      .get("/api/tracker/")
      .then((data: unknown) =>
        setHasInterview((data as { status: string }[]).some((a) => a.status === "Interview"))
      )
      .catch(() => {});
  }, [pathname]);


  const tabs = [
    { label: "Applications", href: "/applications", exact: true },
    { label: "Captured Jobs", href: "/leads", exact: false },
    { label: "Interview", href: "/interview", exact: false },
  ];

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="grid grid-rows-[46px_1fr] grid-cols-[44px_1fr] h-full overflow-hidden bg-background-tertiary font-shell">
      {/* Topbar — spans both columns */}
      <header className="col-[1/-1] flex items-center h-[46px] pr-[14px] bg-background-primary border-b-[0.5px] border-border-tertiary">
        <Link
          href="/"
          title="Dashboard"
          className="w-[44px] h-[46px] shrink-0 flex items-center justify-center border-r-[0.5px] border-border-tertiary"
        >
          <span className="w-[22px] h-[22px] rounded-[5px] bg-custom flex items-center justify-center">
            <Briefcase size={12} color="#fff" />
          </span>
        </Link>

        <nav className="flex pl-1">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            const showDot = tab.href === "/interview" && hasInterview;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-[12px] font-medium px-3 h-[46px] flex items-center gap-[5px] -mb-px font-shell no-underline border-b-2 ${
                  active ? "text-custom border-custom" : "text-text-tertiary border-transparent"
                }`}
              >
                {showDot && (
                  <span
                    aria-label="Active interviews"
                    className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] shrink-0 inline-block"
                  />
                )}
                {tab.label}
              </Link>
            );
          })}
        </nav>

      </header>

      {/* Icon sidebar */}
      <aside className="flex flex-col items-center py-2.5 gap-0.5 border-r-[0.5px] border-border-tertiary bg-background-primary">
        <SidebarBtn href="/setup" label="Resume">
          <FileUser size={19} />
        </SidebarBtn>
        <SidebarBtn href="/skills" label="Skills">
          <Brain size={19} />
        </SidebarBtn>
        <SidebarBtn href="/trash" label="Trash">
          <Trash2 size={19} />
        </SidebarBtn>
        <div className="w-5 h-[0.5px] bg-border-tertiary my-1" />
        <SidebarBtn href="/settings" label="Settings">
          <Settings size={19} />
        </SidebarBtn>
      </aside>

      {/* Main content */}
      <main className="overflow-hidden min-h-0 bg-background-primary">
        {children}
      </main>
    </div>
  );
}

function SidebarBtn({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <Link
        href={href}
        aria-label={label}
        className="w-8 h-8 rounded-[7px] flex items-center justify-center text-text-tertiary no-underline transition-colors duration-100 hover:bg-background-secondary"
      >
        {children}
      </Link>
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-background-primary border-[0.5px] border-border-tertiary rounded-[6px] py-1 px-2 text-[11px] font-medium font-shell text-text-secondary whitespace-nowrap pointer-events-none z-50 shadow-[0_2px_8px_rgba(0,0,0,0.1)] opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </div>
    </div>
  );
}
