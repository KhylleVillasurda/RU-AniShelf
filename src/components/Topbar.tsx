import { Search } from "lucide-react";

interface TopbarProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Topbar({
  title,
  searchQuery,
  onSearchChange,
}: TopbarProps) {
  return (
    <header
      className="flex-shrink-0 flex items-center gap-4 px-6 py-3 border-b"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <h1
        className="text-base font-black tracking-tight flex-shrink-0"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-display)",
        }}
      >
        {title}
      </h1>

      <div
        className="flex items-center gap-2 flex-1 max-w-sm
          border rounded-md px-3 py-1.5 transition-colors"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <Search size={13} style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your anime..."
          className="flex-1 bg-transparent text-xs outline-none
            placeholder-[var(--text-muted)]"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
          }}
        />
      </div>
    </header>
  );
}
