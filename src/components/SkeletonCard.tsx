interface SkeletonCardProps {
  variant?: "active" | "pending";
}

export default function SkeletonCard({
  variant = "pending",
}: SkeletonCardProps) {
  const isActive = variant === "active";

  return (
    <div
      className="flex flex-col rounded-md border overflow-hidden"
      style={{
        background: "var(--bg-card)",
        borderColor: isActive
          ? "var(--border-default)"
          : "var(--border-subtle)",
      }}
    >
      {/* Cover placeholder — 2:3 aspect like real card */}
      <div
        className="relative aspect-[2/3] overflow-hidden"
        style={{ background: "var(--bg-elevated)" }}
      >
        {/* Shimmer sweep */}
        <div
          className={`absolute inset-0 ${
            isActive ? "animate-pulse" : "opacity-40"
          }`}
          style={{
            background: isActive
              ? "linear-gradient(90deg, transparent 0%, var(--border-subtle) 50%, transparent 100%)"
              : "var(--bg-elevated)",
            backgroundSize: "200% 100%",
            animation: isActive
              ? "shimmer 1.4s ease-in-out infinite"
              : undefined,
          }}
        />
        {/* Spinner on active slot */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent
                animate-spin"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        )}
      </div>

      {/* Info placeholder */}
      <div className="p-2 flex flex-col gap-2">
        {/* Title line */}
        <div
          className={`h-2.5 rounded-full ${isActive ? "animate-pulse w-4/5" : "w-3/5 opacity-30"}`}
          style={{ background: "var(--border-default)" }}
        />
        {/* Subtitle line */}
        <div
          className={`h-2 rounded-full ${isActive ? "animate-pulse w-3/5" : "w-2/5 opacity-20"}`}
          style={{ background: "var(--border-subtle)" }}
        />
        {/* Meta line */}
        <div
          className={`h-2 rounded-full ${isActive ? "animate-pulse w-2/5" : "w-1/4 opacity-20"}`}
          style={{ background: "var(--border-subtle)" }}
        />
      </div>
    </div>
  );
}
