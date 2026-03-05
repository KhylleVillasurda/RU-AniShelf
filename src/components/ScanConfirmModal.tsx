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
        className="w-full max-w-2xl max-h-[80vh] flex flex-col
          rounded-xl border shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <Search size={16} style={{ color: "var(--accent)" }} />
            <h2
              className="text-base font-black"
              style={{ color: "var(--text-primary)" }}
            >
              Review Titles
            </h2>
          </div>
          <p
            className="text-[11px] pl-7"
            style={{ color: "var(--text-muted)" }}
          >
            Titles were auto-cleaned from your folder names. Use the{" "}
            <span style={{ color: "var(--text-secondary)" }}>✏ pencil</span> to
            fix any before fetching metadata.
          </p>
        </div>

        {/* Series list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg px-4 py-3 border"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
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
                    className="flex-1 rounded-md px-3 py-1.5 text-sm
                      outline-none border transition-colors"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  <button
                    onClick={() => confirmEdit(index)}
                    className="w-7 h-7 rounded-md flex items-center
                      justify-center border transition-colors"
                    style={{
                      background: "var(--accent-dim)",
                      borderColor: "var(--border-default)",
                      color: "var(--accent)",
                    }}
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="w-7 h-7 rounded-md flex items-center
                      justify-center border transition-colors"
                    style={{
                      background: "rgba(255,68,102,0.1)",
                      borderColor: "rgba(255,68,102,0.2)",
                      color: "#ff4466",
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.editedName}
                    </div>
                    {item.editedName !== item.originalName && (
                      <div
                        className="text-[10px] truncate mt-0.5 flex
                          items-center gap-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <FolderOpen size={9} />
                        {item.originalName}
                      </div>
                    )}
                  </div>

                  {/* Episode count */}
                  <span
                    className="text-[10px] flex-shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.episodeCount} ep
                  </span>

                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(index);
                    }}
                    className="w-7 h-7 rounded-md border flex items-center
                      justify-center transition-all flex-shrink-0"
                    style={{
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--border-default)";
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--border-subtle)";
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--text-muted)";
                    }}
                    title="Edit title"
                  >
                    <Pencil size={11} />
                  </button>

                  {/* Reset button — only show if edited */}
                  {item.editedName !== item.cleanedName && (
                    <button
                      onClick={() => resetToOriginal(index)}
                      className="w-7 h-7 rounded-md border flex items-center
                        justify-center transition-all flex-shrink-0"
                      style={{
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-muted)",
                      }}
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
          className="px-6 py-4 border-t flex items-center
            justify-between flex-shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {items.length} series found
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border text-sm
                transition-all"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
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
                font-bold text-sm transition-colors"
              style={{
                background: "var(--accent)",
                color: "#050508",
              }}
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
