export default function Loading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-neutral-200" />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-9 w-full max-w-xs animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-neutral-100" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
          >
            <div className="h-32 animate-pulse bg-neutral-100" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
