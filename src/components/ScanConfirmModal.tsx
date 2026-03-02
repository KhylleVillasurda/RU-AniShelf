import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Search, FolderOpen } from "lucide-react";

interface ScanEntry {
  originalName: string;
  cleanedName: string;
  editedName: string;
  path: string;
  episodeCount: number;
}

interface ScanConfirmModalProps {
  entries: ScanEntry[];
  onConfirm: (entries: ScanEntry[]) => void;
  onCancel: () => void;
}

export type { ScanEntry };

export default function ScanConfirmModal({
  entries,
  onConfirm,
  onCancel,
}: ScanConfirmModalProps) {
  const [items, setItems] = useState<ScanEntry[]>(entries);
  const itemsRef = useRef<ScanEntry[]>(entries);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditValue(items[index].editedName);
  }

  function confirmEdit(index: number) {
    const updated = items.map((item, i) =>
      i === index
        ? { ...item, editedName: editValue.trim() || item.cleanedName }
        : item,
    );
    itemsRef.current = updated;
    setItems(updated);
    setEditingIndex(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  function resetToOriginal(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, editedName: item.cleanedName } : item,
      ),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/70 backdrop-blur-sm"
    >
      <div
        className="bg-[#0e0e1a] border border-[#00d4ff]/20 rounded-xl
        w-full max-w-2xl max-h-[80vh] flex flex-col
        shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#00d4ff]/10 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <Search size={16} className="text-[#00d4ff]" />
            <h2 className="text-base font-black text-[#f0f4ff]">
              Confirm Series Titles
            </h2>
          </div>
          <p className="text-[11px] text-[#445566] pl-7">
            Review and edit titles before fetching metadata from AniList. Click
            the pencil icon to rename any series.
          </p>
        </div>

        {/* Series list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-[#13131f] border border-[#00d4ff]/08
                rounded-lg px-4 py-3"
            >
              {editingIndex === index ? (
                /* Edit mode */
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit(index);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 bg-[#0e0e1a] border border-[#00d4ff]/30
                      rounded-md px-3 py-1.5 text-sm text-[#f0f4ff]
                      outline-none focus:border-[#00d4ff]/60"
                  />
                  <button
                    onClick={() => confirmEdit(index)}
                    className="w-7 h-7 rounded-md bg-[#00d4ff]/15
                      border border-[#00d4ff]/30 flex items-center
                      justify-center text-[#00d4ff] hover:bg-[#00d4ff]/25
                      transition-colors"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="w-7 h-7 rounded-md bg-[#ff4466]/10
                      border border-[#ff4466]/20 flex items-center
                      justify-center text-[#ff4466] hover:bg-[#ff4466]/20
                      transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Edited/cleaned title */}
                    <div className="text-sm font-bold text-[#f0f4ff] truncate">
                      {item.editedName}
                    </div>
                    {/* Show original if different */}
                    {item.editedName !== item.originalName && (
                      <div className="text-[10px] text-[#445566] truncate mt-0.5">
                        <FolderOpen size={9} className="inline mr-1" />
                        {item.originalName}
                      </div>
                    )}
                  </div>

                  {/* Episode count */}
                  <span className="text-[10px] text-[#445566] flex-shrink-0">
                    {item.episodeCount} ep
                  </span>

                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(index)}
                    className="w-7 h-7 rounded-md border border-[#00d4ff]/10
                      flex items-center justify-center text-[#445566]
                      hover:border-[#00d4ff]/30 hover:text-[#00d4ff]
                      transition-all flex-shrink-0"
                  >
                    <Pencil size={11} />
                  </button>

                  {/* Reset button — only show if edited */}
                  {item.editedName !== item.cleanedName && (
                    <button
                      onClick={() => resetToOriginal(index)}
                      className="w-7 h-7 rounded-md border border-[#445566]/20
                        flex items-center justify-center text-[#445566]
                        hover:border-[#445566]/40 hover:text-[#8899bb]
                        transition-all flex-shrink-0"
                      title="Reset to auto-cleaned name"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t border-[#00d4ff]/10
          flex items-center justify-between flex-shrink-0"
        >
          <p className="text-[11px] text-[#445566]">
            {items.length} series ready to import
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border border-[#00d4ff]/10
                text-[#8899bb] text-sm hover:border-[#00d4ff]/25
                hover:text-[#f0f4ff] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const finalItems = itemsRef.current.map((item, i) =>
                  i === editingIndex
                    ? {
                        ...item,
                        editedName: editValue.trim() || item.cleanedName,
                      }
                    : item,
                );
                onConfirm(finalItems);
              }}
              className="flex items-center gap-2 px-5 py-2 rounded-md
                bg-[#00d4ff] text-[#050508] font-bold text-sm
                hover:bg-[#00bfe8] transition-colors"
            >
              <Search size={13} />
              Fetch Metadata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
