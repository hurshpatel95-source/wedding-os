import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/lead-types";

const TONE: Record<LeadStatus, string> = {
  new: "bg-rose-100 text-rose-800 border-rose-200",
  contacted: "bg-blue-100 text-blue-800 border-blue-200",
  booked_call: "bg-amber-100 text-amber-800 border-amber-200",
  qualified: "bg-emerald-100 text-emerald-800 border-emerald-200",
  converted: "bg-stone-900 text-white border-stone-900",
  lost: "bg-stone-100 text-stone-500 border-stone-200",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase tracking-wider ${TONE[status]}`}
    >
      {LEAD_STATUS_LABEL[status]}
    </Badge>
  );
}
