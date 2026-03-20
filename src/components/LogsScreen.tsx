import { useState } from "react";
import { useStore, LogCategory, LogEntry } from "../store/useStore";
import { invoke } from "@tauri-apps/api/core";
import {
  FileText,
  Plug,
  Server,
  Key,
  FolderOpen,
  Terminal,
  Shuffle,
  LayoutGrid,
  ShieldCheck,
  Trash2,
  Filter,
} from "lucide-react";

const CATEGORY_CONFIG: Record<
  LogCategory,
  { label: string; icon: typeof FileText; color: string }
> = {
  connection: { label: "Connection", icon: Plug, color: "text-green-400" },
  host: { label: "Host", icon: Server, color: "text-blue-400" },
  key: { label: "Key", icon: Key, color: "text-amber-400" },
  group: { label: "Group", icon: FolderOpen, color: "text-purple-400" },
  snippet: { label: "Snippet", icon: Terminal, color: "text-cyan-400" },
  "port-forwarding": { label: "Port Forward", icon: Shuffle, color: "text-orange-400" },
  tab: { label: "Tab", icon: LayoutGrid, color: "text-slate-400" },
  sftp: { label: "SFTP", icon: FolderOpen, color: "text-teal-400" },
  vault: { label: "Vault", icon: ShieldCheck, color: "text-red-400" },
  terminal: { label: "Terminal", icon: Terminal, color: "text-indigo-400" },
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getDayLabel(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDay(logs: LogEntry[]): Map<string, LogEntry[]> {
  const groups = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const label = getDayLabel(log.timestamp);
    const existing = groups.get(label);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(label, [log]);
    }
  }
  return groups;
}

const LogsScreen: React.FC = () => {
  const { logs, clearLogs } = useStore();
  const [activeFilter, setActiveFilter] = useState<LogCategory | "all">("all");

  const filteredLogs =
    activeFilter === "all"
      ? logs
      : logs.filter((l) => l.category === activeFilter);

  const grouped = groupByDay(filteredLogs);

  const handleClearAll = async () => {
    clearLogs();
    try {
      await invoke("clear_logs");
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const categories = Object.keys(CATEGORY_CONFIG) as LogCategory[];

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              Activity Log
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Track all actions performed in SwiftSSH
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
              {filteredLogs.length} entries
            </div>
            {logs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-400/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
              activeFilter === "all"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const count = logs.filter((l) => l.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  activeFilter === cat
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
                }`}
              >
                {config.label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-[#1e2130] rounded-2xl flex items-center justify-center mb-4 border border-[#2a2d3e]">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-gray-300 font-medium">No activity logged yet</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-64">
              Actions you perform in SwiftSSH will appear here
            </p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([dayLabel, entries]) => (
          <div key={dayLabel} className="mb-6">
            <div className="sticky top-0 z-10 bg-[#1a1f2e]/90 backdrop-blur-sm py-2 mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {dayLabel}
              </h2>
            </div>
            <div className="space-y-1.5">
              {entries.map((entry) => {
                const config = CATEGORY_CONFIG[entry.category];
                const Icon = config.icon;
                return (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-3 px-3 py-2.5 bg-[#1e2130]/30 hover:bg-[#1e2130]/60 border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl transition-all"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg bg-white/5 ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-snug">
                        {entry.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.color} bg-white/5`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {entry.action}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-600 font-mono shrink-0 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogsScreen;
