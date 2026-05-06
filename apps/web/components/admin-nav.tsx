"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  Heart,
  Library,
  LogOut,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/library", label: "Library", icon: Library },
  { href: "/admin/playbook", label: "Playbook", icon: BookOpen },
  { href: "/admin/vendors", label: "Vendors", icon: Briefcase },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

interface WorkspaceOption {
  id: string;
  name: string;
}

export function AdminNav({
  userEmail,
  workspaces,
}: {
  userEmail: string | null;
  workspaces: WorkspaceOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/40 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        {/* Left: studio brand */}
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-600 shadow-sm">
            <Heart className="h-4 w-4 text-white" fill="white" />
          </div>
          <div className="leading-none">
            <div className="font-serif text-lg font-medium tracking-tight">
              Studio
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </div>
          </div>
        </Link>

        {/* Center: pill tabs */}
        <nav className="hidden items-center gap-1 rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur md:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: workspace-as picker stub + sign out */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-stone-900"
            >
              View as workspace
              <ChevronDown className="h-3 w-3" />
            </button>
            {pickerOpen && (
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                <div className="border-b border-stone-100 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-stone-400">
                  Workspaces
                </div>
                {workspaces.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-stone-500">
                    No workspaces yet
                  </div>
                ) : (
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {workspaces.map((w) => (
                      <li key={w.id}>
                        <Link
                          href={`/?as=${w.id}`}
                          onClick={() => setPickerOpen(false)}
                          className="block px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
                        >
                          {w.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-stone-100 px-4 py-2 text-[10px] text-stone-400">
                  Stub — wiring comes in Wave 2
                </div>
              </div>
            )}
          </div>

          {userEmail && (
            <button
              type="button"
              onClick={handleSignOut}
              title={`Sign out ${userEmail}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white/60 text-stone-500 transition hover:bg-white hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile pill row */}
      <nav className="container flex items-center gap-1 overflow-x-auto pb-3 md:hidden">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-stone-900 text-white"
                  : "border border-stone-200 bg-white/60 text-stone-600",
              )}
            >
              <Icon className="h-3 w-3" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
