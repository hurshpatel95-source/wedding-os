import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS_LABEL, type ContractStatus } from "@/lib/tier1-types";

const TONE: Record<ContractStatus, string> = {
  draft: "bg-stone-100 text-stone-700 border-stone-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  viewed: "bg-amber-100 text-amber-800 border-amber-200",
  signed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
  voided: "bg-stone-100 text-stone-500 border-stone-200",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase tracking-wider ${TONE[status]}`}
    >
      {CONTRACT_STATUS_LABEL[status]}
    </Badge>
  );
}
