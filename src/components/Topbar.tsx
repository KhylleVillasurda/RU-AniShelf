import { Search, SlidersHorizontal } from "lucide-react";

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
      className="h-14 flex items-center gap-4 px-6 
      bg-[#0e0e1a] border-b border-[#00d4ff]/10 flex-shrink-0"
    >
      {/* Page title */}
      <h1 className="font-black text-lg text-[#f0f4ff] tracking-tight flex-shrink-0">
        {title}
      </h1>

      {/* Search */}
      <div
        className="flex-1 flex items-center gap-2 bg-[#13131f] 
        border border-[#00d4ff]/10 rounded-md px-3 py-1.5
        focus-within:border-[#00d4ff]/30 transition-colors"
      >
        <Search size={13} className="text-[#445566] flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your anime..."
          className="flex-1 bg-transparent text-[#f0f4ff] text-sm 
            placeholder-[#445566] outline-none"
        />
      </div>

      {/* Filter button */}
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-md
        border border-[#00d4ff]/10 text-[#8899bb] text-sm
        hover:border-[#00d4ff]/30 hover:text-[#f0f4ff] transition-all"
      >
        <SlidersHorizontal size={13} />
        <span>Filter</span>
      </button>
    </header>
  );
}
