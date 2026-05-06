// Root loading boundary — Next.js shows this whenever a server component
// is awaiting data (force-dynamic everywhere makes that common). Replaces
// the blank-screen-then-flash UX with a soft skeleton.

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-stone-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-stone-400 [animation-delay:240ms]" />
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em]">Loading</div>
      </div>
    </div>
  );
}
