"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getFunnel } from "@/lib/adminApi";
import { ADMISSIONS_CYCLE_LABEL, PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { useAdminAuth } from "./AdminAuthProvider";
import {
  BookIcon,
  CalendarIcon,
  GridIcon,
  LogoutIcon,
  MicIcon,
  PhoneIcon,
  SlidersIcon,
  UsersIcon,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: typeof GridIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { href: "/admin/overview", label: "Overview", icon: GridIcon },
  { href: "/admin/applications", label: "Applications", icon: UsersIcon },
  { href: "/admin/campus-schedule", label: "Campus Schedule", icon: CalendarIcon },
];

const CONFIG_ITEMS: NavItem[] = [
  { href: "/admin/preferences", label: "Preferences", icon: SlidersIcon },
  { href: "/admin/question-bank", label: "Question Bank", icon: BookIcon },
  { href: "/admin/interview-prompts", label: "Interview Prompts", icon: MicIcon },
];

const OUTREACH_ITEMS: NavItem[] = [
  { href: "/admin/interview-calls", label: "Interview Calls", icon: PhoneIcon },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();

  // Shared with the Overview page's query key so the sidebar badges and the
  // funnel card reuse the same cached fetch instead of double-requesting.
  const { data: funnel } = useQuery({
    queryKey: ["funnel", PROGRAM_ID],
    queryFn: () => getFunnel(PROGRAM_ID),
  });

  const applicationsBadge = funnel?.received;
  // The funnel only exposes cumulative "reached this stage" counts, not a
  // ready-to-call set, so this estimates it as candidates who've completed
  // both campus activities minus those already called — a heuristic, not a
  // real backend count.
  const interviewCallsBadge = funnel
    ? Math.max(0, Math.min(funnel.test_a_complete, funnel.test_b_complete) - funnel.called_for_interview)
    : undefined;

  function badgeFor(href: string): number | undefined {
    if (href === "/admin/applications") return applicationsBadge;
    if (href === "/admin/interview-calls") return interviewCallsBadge;
    return undefined;
  }

  function renderItem(item: NavItem) {
    const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
    const Icon = item.icon;
    const badge = badgeFor(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
          active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon className="w-[17px] h-[17px]" />
          {item.label}
        </span>
        {badge != null && badge > 0 && (
          <span
            className={`text-[10.5px] font-bold rounded-full px-1.5 py-0.5 leading-none ${
              active ? "bg-gold text-ink-dark" : "bg-white/10 text-gold"
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="w-[248px] shrink-0 h-screen sticky top-0 flex flex-col bg-ink-dark text-white">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-9 h-9 rounded-[10px] bg-gold flex items-center justify-center text-lg shrink-0">
          🎓
        </div>
        <div>
          <div className="font-serif font-bold text-[15px] leading-tight">Admit</div>
          <div className="text-[10.5px] text-white/50">Screening Portal</div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-white/35 mb-2">
          Program
        </div>
        <div className="rounded-xl bg-white/5 px-3.5 py-3">
          <div className="text-[13.5px] font-semibold">{PROGRAM_LABEL}</div>
          <div className="text-[11px] text-white/50 mt-0.5">{ADMISSIONS_CYCLE_LABEL}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-6 pb-4">
        <div>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-white/35 px-3 mb-1.5">
            Main
          </div>
          <div className="space-y-0.5">{MAIN_ITEMS.map(renderItem)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-white/35 px-3 mb-1.5">
            Configuration
          </div>
          <div className="space-y-0.5">{CONFIG_ITEMS.map(renderItem)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-white/35 px-3 mb-1.5">
            Outreach
          </div>
          <div className="space-y-0.5">{OUTREACH_ITEMS.map(renderItem)}</div>
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[12.5px] font-semibold shrink-0">
            {(admin?.full_name || admin?.email || "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold truncate">
              {admin?.full_name || "Admin"}
            </div>
            <div className="text-[10.5px] text-white/45 truncate">{admin?.email ?? ""}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-[12px] text-white/50 hover:text-white transition w-full"
        >
          <LogoutIcon className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
