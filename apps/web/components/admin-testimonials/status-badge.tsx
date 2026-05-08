import {
  TESTIMONIAL_STATUS_LABEL,
  type TestimonialStatus,
} from "@/lib/wave2-types";

const TONE: Record<TestimonialStatus, string> = {
  requested: "border-stone-200 bg-stone-50 text-stone-700",
  submitted: "border-amber-200 bg-amber-50 text-amber-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  declined: "border-rose-200 bg-rose-50 text-rose-800",
};

export function TestimonialStatusBadge({
  status,
}: {
  status: TestimonialStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE[status]}`}
    >
      {TESTIMONIAL_STATUS_LABEL[status]}
    </span>
  );
}
