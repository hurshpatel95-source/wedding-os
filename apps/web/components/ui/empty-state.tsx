// Reusable empty-state card. Replaces the ad-hoc "No X yet" copy
// scattered around. Use on first-load of any list page so a fresh
// workspace / fresh org doesn't feel broken.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary CTA — usually "+ Add X" or "Import" */
  primary?: { label: string; href: string };
  /** Optional secondary link */
  secondary?: { label: string; href: string };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primary,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed border-stone-300 bg-stone-50/40", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <h3 className="font-serif text-2xl font-light tracking-tight text-stone-900">
          {title}
        </h3>
        {description && (
          <p className="max-w-md text-sm text-stone-600">{description}</p>
        )}
        {(primary || secondary) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {primary && (
              <Link href={primary.href}>
                <Button>{primary.label}</Button>
              </Link>
            )}
            {secondary && (
              <Link href={secondary.href}>
                <Button variant="outline">{secondary.label}</Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
