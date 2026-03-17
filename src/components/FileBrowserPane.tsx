import { useState, useMemo } from "react";
import {
  ChevronUp,
  RefreshCw,
  FolderPlus,
  Trash2,
  Download,
  Upload,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { getFileIcon, formatFileSize, formatDate } from "../utils/fileIcons";
import type { FileEntry } from "../store/useStore";

type SortKey = "name" | "size" | "mtime" | "permissions";
type SortDir = "asc" | "desc";

interface FileBrowserPaneProps {
  title: "Local" | "Remote";
  entries: FileEntry[];
  currentPath: string;
  loading: boolean;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  selectedEntries: Set<string>;
  onSelect: (names: Set<string>) => void;
  onTransfer?: (entries: FileEntry[]) => void;
  onDelete?: (entry: FileEntry) => void;
  onRename?: (entry: FileEntry, newName: string) => void;
  onMkdir?: (name: string) => void;
}

export default function FileBrowserPane({
  title,
  entries,
  currentPath,
  loading,
  onNavigate,
  onRefresh,
  selectedEntries,
  onSelect,
  onTransfer,
  onDelete,
  onRename,
  onMkdir,
}: FileBrowserPaneProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showMkdir, setShowMkdir] = useState(false);
  const [mkdirValue, setMkdirValue] = useState("");

  const pathSegments = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      name: part,
      path: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [currentPath]);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      // Dirs always first
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "mtime":
          cmp = a.mtime - b.mtime;
          break;
        case "permissions":
          cmp = a.permissions.localeCompare(b.permissions);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [entries, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDir) {
      const newPath =
        currentPath === "/"
          ? `/${entry.name}`
          : `${currentPath}/${entry.name}`;
      onNavigate(newPath);
    }
  };

  const handleRowClick = (entry: FileEntry, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedEntries);
      if (next.has(entry.name)) {
        next.delete(entry.name);
      } else {
        next.add(entry.name);
      }
      onSelect(next);
    } else {
      onSelect(new Set([entry.name]));
    }
  };

  const goUp = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    onNavigate(parent);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleMkdir = () => {
    if (mkdirValue.trim() && onMkdir) {
      onMkdir(mkdirValue.trim());
      setMkdirValue("");
      setShowMkdir(false);
    }
  };

  const handleRename = (entry: FileEntry) => {
    if (renameValue.trim() && onRename && renameValue !== entry.name) {
      onRename(entry, renameValue.trim());
    }
    setRenamingEntry(null);
    setRenameValue("");
  };

  const selectedFileEntries = entries.filter((e) => selectedEntries.has(e.name));

  return (
    <div
      className="flex flex-col h-full bg-space-dark"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-[#161d2b]">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-1">
          {onTransfer && selectedFileEntries.length > 0 && (
            <button
              onClick={() => onTransfer(selectedFileEntries)}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
              title={title === "Local" ? "Upload selected" : "Download selected"}
            >
              {title === "Local" ? (
                <Upload className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={() => setShowMkdir(true)}
            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
            title="New folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-800/50 overflow-x-auto no-scrollbar">
        <button
          onClick={goUp}
          className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded shrink-0 transition-colors"
          title="Go up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onNavigate("/")}
          className="text-[11px] text-slate-500 hover:text-blue-400 px-1 shrink-0 transition-colors"
        >
          /
        </button>
        {pathSegments.map((seg, i) => (
          <span key={seg.path} className="flex items-center shrink-0">
            <span className="text-slate-600 text-[10px]">/</span>
            <button
              onClick={() => onNavigate(seg.path)}
              className={`text-[11px] px-1 transition-colors ${
                i === pathSegments.length - 1
                  ? "text-white font-medium"
                  : "text-slate-400 hover:text-blue-400"
              }`}
            >
              {seg.name}
            </button>
          </span>
        ))}
      </div>

      {/* Mkdir input */}
      {showMkdir && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 bg-slate-900/50">
          <FolderPlus className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            placeholder="New folder name..."
            value={mkdirValue}
            onChange={(e) => setMkdirValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMkdir();
              if (e.key === "Escape") {
                setShowMkdir(false);
                setMkdirValue("");
              }
            }}
            onBlur={() => {
              setShowMkdir(false);
              setMkdirValue("");
            }}
          />
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-12 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/30">
        <button
          onClick={() => toggleSort("name")}
          className="col-span-6 flex items-center gap-1 hover:text-slate-300 text-left transition-colors"
        >
          Name
          {sortKey === "name" && (
            <ArrowUpDown className="w-2.5 h-2.5" />
          )}
        </button>
        <button
          onClick={() => toggleSort("size")}
          className="col-span-2 flex items-center gap-1 hover:text-slate-300 text-right transition-colors"
        >
          Size
          {sortKey === "size" && (
            <ArrowUpDown className="w-2.5 h-2.5" />
          )}
        </button>
        <button
          onClick={() => toggleSort("permissions")}
          className="col-span-2 flex items-center gap-1 hover:text-slate-300 transition-colors"
        >
          Perms
        </button>
        <button
          onClick={() => toggleSort("mtime")}
          className="col-span-2 flex items-center gap-1 hover:text-slate-300 transition-colors"
        >
          Modified
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            Loading...
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            Empty directory
          </div>
        ) : (
          sortedEntries.map((entry) => {
            const Icon = getFileIcon(entry.name, entry.isDir, entry.isSymlink);
            const isSelected = selectedEntries.has(entry.name);
            const isRenaming = renamingEntry === entry.name;

            return (
              <div
                key={entry.name}
                className={`grid grid-cols-12 px-3 py-1 text-[11px] items-center cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-500/15 text-white"
                    : "text-slate-300 hover:bg-slate-800/50"
                }`}
                onClick={(e) => handleRowClick(entry, e)}
                onDoubleClick={() => handleDoubleClick(entry)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
              >
                <div className="col-span-6 flex items-center gap-2 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      entry.isDir ? "text-blue-400" : "text-slate-500"
                    }`}
                  />
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="bg-slate-900 border border-blue-500/50 text-white text-[11px] px-1 py-0.5 rounded outline-none w-full"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(entry);
                        if (e.key === "Escape") {
                          setRenamingEntry(null);
                          setRenameValue("");
                        }
                      }}
                      onBlur={() => handleRename(entry)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{entry.name}</span>
                  )}
                </div>
                <div className="col-span-2 text-right text-slate-500">
                  {entry.isDir ? "—" : formatFileSize(entry.size)}
                </div>
                <div className="col-span-2 text-slate-500 font-mono text-[10px]">
                  {entry.permStr?.slice(0, 4) || entry.permissions}
                </div>
                <div className="col-span-2 text-slate-500">
                  {formatDate(entry.mtime)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer status */}
      <div className="px-3 py-1 border-t border-slate-800/50 text-[10px] text-slate-500 flex justify-between">
        <span>{entries.length} items</span>
        {selectedEntries.size > 0 && (
          <span>{selectedEntries.size} selected</span>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#1a1f2e] border border-slate-700 shadow-2xl rounded-lg py-1 w-44 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onTransfer && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-2 transition-colors"
              onClick={() => {
                onTransfer([contextMenu.entry]);
                setContextMenu(null);
              }}
            >
              {title === "Local" ? (
                <Upload className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {title === "Local" ? "Upload" : "Download"}
            </button>
          )}
          {onRename && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-2 transition-colors"
              onClick={() => {
                setRenamingEntry(contextMenu.entry.name);
                setRenameValue(contextMenu.entry.name);
                setContextMenu(null);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
          )}
          {onDelete && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/10 flex items-center gap-2 transition-colors"
              onClick={() => {
                onDelete(contextMenu.entry);
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
