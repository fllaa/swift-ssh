import { useStore } from "../store/useStore";
import { v4 as uuidv4 } from "uuid";
import { Search, LayoutGrid, List, Plus, Cloud, Layers, Code2, PlusCircle, ChevronRight, Database, Globe, Box, Container, Cpu, HardDrive, Monitor } from "lucide-react";

export default function Dashboard() {
  const { hosts, groups, activeVaultId, addTab } = useStore();

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
          <div className="border border-dashed border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60">
            <Plus className="w-8 h-8 text-slate-600" />
            <span className="text-sm font-medium text-slate-500">Connect New Server</span>
          </div>
        </div>
      </section>
    </div>
  );
}
