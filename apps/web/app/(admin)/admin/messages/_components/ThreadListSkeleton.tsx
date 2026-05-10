const SKELETON_W = ["62%", "48%", "72%"] as const;

/** Three shimmer placeholder rows shown while ThreadList is loading. */
export function ThreadListSkeleton() {
  return (
    <div>
      {([0, 1, 2] as const).map((i) => (
        <div key={i} className="flex gap-3 items-center px-4 py-3 border-b border-admin-line">
          <div className="w-9 h-9 rounded-full bg-admin-line animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-admin-line animate-pulse" style={{ width: SKELETON_W[i] }} />
            <div className="h-2.5 rounded bg-admin-line/60 animate-pulse" style={{ width: SKELETON_W[i] }} />
          </div>
          <div className="w-10 h-2.5 rounded bg-admin-line/70 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
