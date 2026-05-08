// Tiny server component used by other agents — drops a "X files" badge
// that deep-links to the vendor's Files tab. Keeps the call-site one line
// and centralizes the URL shape (#files anchor) so we can change it later
// without hunting every consumer.

import Link from "next/link";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilesTabLinkProps {
  vendorId: string;
  count: number;
  className?: string;
}

export function FilesTabLink({ vendorId, count, className }: FilesTabLinkProps) {
  const label = count === 1 ? "1 file" : `${count} files`;
  return (
    <Link
      href={`/vendors/${vendorId}#files`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50",
        className,
      )}
      title={`View ${label} in this vendor's folder`}
    >
      <Folder className="h-3 w-3 text-stone-500" />
      {label}
    </Link>
  );
}
