import { useState, useEffect, useRef } from "react";
import { Search, X, Server, Clock } from "lucide-react";
import { useStore, HostProfile } from "../store/useStore";
import { getDistroIcon } from "../utils/distroIcon";

interface NewTabModalProps {
  onClose: () => void;
  onConnect: (host: HostProfile) => void;
}

export default function NewTabModal({ onClose, onConnect }: NewTabModalProps) {
  const { hosts } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter hosts based on search query
  const filteredHosts = hosts.filter((host) => {
    const query = searchQuery.toLowerCase();
    return (
      (host.label || "").toLowerCase().includes(query) ||
      host.hostname.toLowerCase().includes(query) ||
      host.username.toLowerCase().includes(query)
    );
  });

  // Sort by lastConnected (descending)
  const sortedHosts = [...filteredHosts].sort((a, b) => {
    const timeA = a.lastConnected || 0;
    const timeB = b.lastConnected || 0;
    return timeB - timeA;
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatLastConnected = (timestamp?: number) => {
    if (!timestamp) return "Never connected";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-100 p-4 animate-in fade-in duration-200">
      <div
        className="bg-card-slate border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 text-lg"
            placeholder="Search hosts to connect..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] p-2 space-y-1 bg-slate-900/20">
          {sortedHosts.length > 0 ? (
            sortedHosts.map((host) => (
              <div
                key={host.id}
                onClick={() => onConnect(host)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-600/10 border border-transparent hover:border-blue-500/30 cursor-pointer group transition-all"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-blue-900/50 transition-colors shrink-0">
                    {getDistroIcon(host.osIcon) ? (
                      <img
                        src={getDistroIcon(host.osIcon)!}
                        className="w-5 h-5"
                        alt={host.osIcon}
                      />
                    ) : (
                      <Server className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-200 truncate">
                      {host.label || host.hostname}
                    </span>
                    <span className="text-xs text-slate-500 truncate mt-0.5">
                      {host.username}@{host.hostname}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-slate-500 text-xs shrink-0 pl-4">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatLastConnected(host.lastConnected)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p>No hosts found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
