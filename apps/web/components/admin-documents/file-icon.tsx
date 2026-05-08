import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

/** Pick a lucide icon based on a mime type or filename. Tiny stateless helper.
 *  Used by the documents panel to give each row a sensible glyph without
 *  loading the actual file. */
export function pickFileIcon(
  mime: string | null | undefined,
  name: string | null | undefined,
): LucideIcon {
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();

  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(n)) {
    return ImageIcon;
  }
  if (
    m === "application/pdf" ||
    /\.pdf$/i.test(n) ||
    m.startsWith("application/msword") ||
    m.includes("officedocument.wordprocessingml") ||
    /\.(docx?|rtf|txt|md)$/i.test(n)
  ) {
    return FileText;
  }
  if (
    m.includes("spreadsheetml") ||
    m === "text/csv" ||
    m === "application/vnd.ms-excel" ||
    /\.(xlsx?|csv|tsv|numbers)$/i.test(n)
  ) {
    return FileSpreadsheet;
  }
  return FileIcon;
}

/** Convenience component: renders the picked icon. */
export function FileTypeIcon({
  mime,
  name,
  className,
}: {
  mime: string | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = pickFileIcon(mime, name);
  return <Icon className={className} />;
}
