import { useStore, HostProfile } from "../store/useStore";
import { v4 as uuidv4 } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { Search, LayoutGrid, List, Plus, Cloud, Layers, Code2, PlusCircle, ChevronRight, Database, Globe, Box, Container, Cpu, HardDrive, Monitor, Edit2, Trash2 } from "lucide-react";

interface DashboardProps {
  onEditHost: (host: HostProfile) => void;
  onAddHost: () => void;
}

export default function Dashboard({ onEditHost, onAddHost }: DashboardProps) {
  const { hosts, groups, activeVaultId, addTab, removeHost } = useStore();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, host: HostProfile } | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleDelete = async (host: HostProfile) => {
    if (!confirm(`Delete host "${host.label || host.hostname}"?`)) return;
    try {
      await invoke("delete_host", { hostId: host.id });
      removeHost(host.id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const currentGroups = groups.filter(g => g.vaultId === activeVaultId);
  const activeHosts = hosts; // we can filter by group later if needed

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10" id="main-scroll-area">
      {/* Section 1: Groups */}
      <section data-purpose="groups-section">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Groups</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentGroups.map((group) => {
            const groupHosts = hosts.filter((h) => h.groupId === group.id);
            return (
              <div
                key={group.id}
                className="bg-card-slate border border-slate-800 rounded-xl p-4 hover:border-slate-600 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Layers className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{group.name}</h3>
                      <p className="text-xs text-slate-400">{groupHosts.length} hosts</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                </div>
              </div>
            );
          })}

          {/* Add New Group */}
          <div className="border border-dashed border-slate-700 rounded-xl p-4 flex items-center justify-center hover:bg-slate-800/50 cursor-pointer transition-all">
            <div className="flex items-center space-x-2 text-slate-500">
              <PlusCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Add Group</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Hosts Bento Grid */}
      <section data-purpose="hosts-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">All Hosts</h2>
          <span className="text-xs text-slate-500">Showing {activeHosts.length} hosts</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="host-grid">
          {activeHosts.map((host) => (
            <div 
              key={host.id} 
              onClick={() => {
                addTab({
                  tabId: uuidv4(),
                  sessionId: null,
                  hostId: host.id,
                  label: host.label || host.hostname,
                  connected: false,
                });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  host
                });
              }}
              className="bg-card-slate border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 hover:scale-[1.01] transition-all cursor-pointer relative group"
            >
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                  <Database className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{host.label || host.hostname}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{host.username}@{host.hostname}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Add Placeholder */}
          <div 
            onClick={onAddHost}
            className="border border-dashed border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60"
          >
            <Plus className="w-8 h-8 text-slate-600" />
            <span className="text-sm font-medium text-slate-500">Connect New Server</span>
          </div>
        </div>
      </section>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-slate-800 border border-slate-700 shadow-xl rounded-md py-1 w-40 z-50 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              onEditHost(contextMenu.host);
              setContextMenu(null);
            }}
          >
            <Edit2 className="w-4 h-4 text-slate-400" />
            Edit Profile
          </button>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 hover:text-red-300"
            onClick={() => {
              handleDelete(contextMenu.host);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-4 h-4 text-red-400/80" />
            Delete Host
          </button>
        </div>
      )}
    </div>
  );
}
