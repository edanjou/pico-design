export default function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-200" />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-9 w-full max-w-xs animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-neutral-100" />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-neutral-100 p-4 first:border-t-0"
          >
            <div className="h-4 w-1/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-1/5 animate-pulse rounded bg-neutral-100" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
