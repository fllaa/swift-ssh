import { useStore, HostProfile, Group } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import { v4 as uuidv4 } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { Search, Plus, Cloud, Layers, Code2, PlusCircle, ChevronRight, Database, Edit2, Trash2, Server, ArrowLeft, FolderOpen } from "lucide-react";
import { getDistroIcon } from "../utils/distroIcon";
import { ask } from "@tauri-apps/plugin-dialog";

interface DashboardProps {
  onEditHost: (host: HostProfile) => void;
  onAddHost: () => void;
  onAddGroup: () => void;
  onEditGroup: (group: Group) => void;
}

export default function Dashboard({ onEditHost, onAddHost, onAddGroup, onEditGroup }: DashboardProps) {
  const { hosts, groups, activeVaultId, addTab, removeHost, dashboardViewMode, removeGroup, updateHost } = useStore();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, host?: HostProfile, group?: Group } | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const filteredHosts = activeGroupId 
    ? hosts.filter(h => h.groupId === activeGroupId)
    : hosts;

  const getGroupIcon = (iconId?: string) => {
    switch (iconId) {
      case 'cloud': return Cloud;
      case 'database': return Database;
      case 'server': return Server;
      case 'code': return Code2;
      default: return Layers;
    }
  };

  const getGroupColor = (colorClass?: string) => {
    const base = colorClass?.replace('bg-', '') || 'blue-500';
    switch (base) {
      case 'emerald-500': return { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
      case 'purple-500': return { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
      case 'amber-500': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      case 'rose-500': return { text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
      case 'slate-500': return { text: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
      default: return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleDelete = async (host: HostProfile) => {
    const confirmed = await ask(`Delete host "${host.label || host.hostname}"?`, {
      title: "Confirm Deletion",
      kind: "warning",
    });
    if (!confirmed) return;
    try {
      await invoke("delete_host", { host_id: host.id });
      removeHost(host.id);
      logActivity("host", "delete", `Deleted host "${host.label || host.hostname}"`, { hostId: host.id });
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    const confirmed = await ask(`Delete group "${group.name}"? Hosts in this group will become ungrouped.`, {
      title: "Confirm Deletion",
      kind: "warning",
    });
    if (!confirmed) return;
    
    // First, unassign all hosts from this group
    const groupHosts = hosts.filter((h) => h.groupId === group.id);
    groupHosts.forEach(h => {
      updateHost({ ...h, groupId: "" });
      // Ideally we'd also call invoke("save_host", ...) here for each host to persist the change
      // but the current save_host takes the full profile.
      invoke("save_host", { profile: { ...h, groupId: "" } }).catch(console.error);
    });

    removeGroup(group.id);
    invoke("delete_group", { group_id: group.id }).catch(console.error);
    logActivity("group", "delete", `Deleted group "${group.name}"`, { groupId: group.id });
  };

  const currentGroups = groups.filter(g => g.vaultId === activeVaultId);
  const activeHosts = hosts; // we can filter by group later if needed

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10" id="main-scroll-area">
      {activeGroupId && activeGroup ? (
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActiveGroupId(null)}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`size-3 rounded-full ${activeGroup.color || 'bg-blue-500'}`} />
                <h2 className="text-2xl font-bold text-white">{activeGroup.name}</h2>
              </div>
              <p className="text-sm text-slate-500">{filteredHosts.length} hosts in this group</p>
            </div>
          </div>

          <section data-purpose="hosts-section">
            {dashboardViewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredHosts.map((host) => (
                  <div 
                    key={host.id} 
                    onClick={() => {
                      const tabId = uuidv4();
                      addTab(tabId, {
                        tabId: uuidv4(),
                        sessionId: null,
                        hostId: host.id,
                        label: host.label || host.hostname,
                        connected: false,
                        type: "terminal",
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
                    className="bg-card-slate border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 hover:scale-[1.01] transition-all cursor-pointer relative group flex flex-col justify-between h-full"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                        {getDistroIcon(host.osIcon) ? (
                          <img src={getDistroIcon(host.osIcon)!} className="w-6 h-6" alt={host.osIcon} />
                        ) : (
                          <Database className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{host.label || host.hostname}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{host.username}@{host.hostname}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col space-y-1.5">
                <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-2">
                  <div className="col-span-4">Host Details</div>
                  <div className="col-span-3">Configuration</div>
                  <div className="col-span-3">Tags</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                {filteredHosts.map((host) => (
                  <div
                    key={host.id}
                    onClick={() => {
                      const tabId = uuidv4();
                      addTab(tabId, {
                        tabId: uuidv4(),
                        sessionId: null,
                        hostId: host.id,
                        label: host.label || host.hostname,
                        connected: false,
                        type: "terminal",
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
                    className="grid grid-cols-12 items-center bg-card-slate border border-slate-800/50 rounded-xl px-5 py-3 hover:bg-slate-800/60 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="col-span-4 flex items-center space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-700 group-hover:border-blue-500/30 transition-colors">
                        <Database className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-200 truncate">{host.label || host.hostname}</span>
                        <span className="text-[11px] text-slate-500 truncate">{host.hostname}</span>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <code className="text-[11px] px-2 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-800">
                        {host.username}@{host.port || 22}
                      </code>
                    </div>
                    <div className="col-span-3">
                      <span className="text-[10px] text-slate-600 italic">No tags</span>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <div className="p-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500 group-hover:text-blue-400 group-hover:border-blue-400/30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {/* Section 1: Groups */}
          <section data-purpose="groups-section">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Groups</h2>
            {dashboardViewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentGroups.map((group) => {
                  const groupHosts = hosts.filter((h) => h.groupId === group.id);
                  const GroupIcon = getGroupIcon(group.icon);
                  const colors = getGroupColor(group.color);

                  return (
                    <div
                      key={group.id}
                      onClick={() => setActiveGroupId(group.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          group
                        });
                      }}
                      className="bg-card-slate border border-slate-800 rounded-xl p-4 hover:border-slate-600 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 ${colors.bg} rounded-lg group-hover:bg-opacity-20 transition-all`}>
                            <GroupIcon className={`w-5 h-5 ${colors.text}`} />
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
                <div 
                  onClick={onAddGroup}
                  className="border border-dashed border-slate-700 rounded-xl p-4 flex items-center justify-center hover:bg-slate-800/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-2 text-slate-500">
                    <PlusCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Add Group</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-1.5" id="groups-list">
                <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-2">
                  <div className="col-span-5">Group Name</div>
                  <div className="col-span-5">Summary</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                {currentGroups.map((group) => {
                  const groupHosts = hosts.filter((h) => h.groupId === group.id);
                  const GroupIcon = getGroupIcon(group.icon);
                  const colors = getGroupColor(group.color);

                  return (
                    <div 
                      key={group.id} 
                      onClick={() => setActiveGroupId(group.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          group
                        });
                      }}
                      className="grid grid-cols-12 items-center bg-card-slate border border-slate-800/50 rounded-xl px-5 py-3 hover:bg-slate-800/60 hover:border-slate-700 transition-all cursor-pointer group"
                    >
                      <div className="col-span-5 flex items-center space-x-4">
                        <div className={`p-2 ${colors.bg} rounded-lg transition-colors`}>
                          <GroupIcon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <span className="font-semibold text-slate-200 truncate">{group.name}</span>
                      </div>
                      <div className="col-span-5 text-[11px] text-slate-500">
                        {groupHosts.length} hosts
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <div className={`p-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500 group-hover:${colors.text} group-hover:border-${colors.text.replace('text-', '')}/30 transition-all`}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Placeholder in List Mode */}
                <div 
                  onClick={onAddGroup}
                  className="border border-dashed border-slate-800 rounded-xl p-3 flex items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-x-2 group mt-2"
                >
                  <PlusCircle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                  <span className="text-sm font-medium text-slate-500 group-hover:text-slate-400">Add New Group</span>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Hosts */}
          <section data-purpose="hosts-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">All Hosts</h2>
              <span className="text-xs text-slate-500">Showing {activeHosts.length} hosts</span>
            </div>
            
            {dashboardViewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="host-grid">
                {activeHosts.map((host) => (
                  <div
                    key={host.id}
                    onClick={() => {
                      const tabId = uuidv4();
                      addTab(tabId, {
                        tabId: uuidv4(),
                        sessionId: null,
                        hostId: host.id,
                        label: host.label || host.hostname,
                        connected: false,
                        type: "terminal",
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
                    className="bg-card-slate border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 hover:scale-[1.01] transition-all cursor-pointer relative group flex flex-col justify-between h-full"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                        {getDistroIcon(host.osIcon) ? (
                          <img src={getDistroIcon(host.osIcon)!} className="w-6 h-6" alt={host.osIcon} />
                        ) : (
                          <Database className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{host.label || host.hostname}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{host.username}@{host.hostname}</p>
                      </div>
                    </div>
                    {host.tags && (
                      <div className="flex flex-wrap gap-1 mt-4">
                        {host.tags.split(",").map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-800 text-[10px] text-slate-400 rounded-md border border-slate-700">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Placeholder */}
                <div 
                  onClick={onAddHost}
                  className="border border-dashed border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60 min-h-32"
                >
                  <Plus className="w-8 h-8 text-slate-600" />
                  <span className="text-sm font-medium text-slate-500">Connect New Server</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-1.5" id="host-list">
                <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-2">
                  <div className="col-span-4">Host Details</div>
                  <div className="col-span-3">Configuration</div>
                  <div className="col-span-3">Tags</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                {activeHosts.map((host) => (
                  <div
                    key={host.id}
                    onClick={() => {
                      const tabId = uuidv4();
                      addTab(tabId, {
                        tabId: uuidv4(),
                        sessionId: null,
                        hostId: host.id,
                        label: host.label || host.hostname,
                        connected: false,
                        type: "terminal",
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
                    className="grid grid-cols-12 items-center bg-card-slate border border-slate-800/50 rounded-xl px-5 py-3 hover:bg-slate-800/60 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="col-span-4 flex items-center space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-700 group-hover:border-blue-500/30 transition-colors">
                        {getDistroIcon(host.osIcon) ? (
                          <img src={getDistroIcon(host.osIcon)!} className="w-4 h-4" alt={host.osIcon} onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).className = "hidden";
                          }} />
                        ) : (
                          <Database className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-200 truncate">{host.label || host.hostname}</span>
                        <span className="text-[11px] text-slate-500 truncate">{host.hostname}</span>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <code className="text-[11px] px-2 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-800">
                        {host.username}@{host.port || 22}
                      </code>
                    </div>
                    <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                      {host.tags ? (
                        host.tags.split(",").map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-900/50 text-[10px] text-slate-500 rounded border border-slate-800/50">
                            {tag.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">No tags</span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <div className="p-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500 group-hover:text-blue-400 group-hover:border-blue-400/30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add Placeholder in List Mode */}
                <div 
                  onClick={onAddHost}
                  className="border border-dashed border-slate-800 rounded-xl p-3 flex items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-x-2 group mt-2"
                >
                  <Plus className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                  <span className="text-sm font-medium text-slate-500 group-hover:text-slate-400">Add New Connection</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-slate-800 border border-slate-700 shadow-xl rounded-md py-1 w-48 z-50 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.host && (
            <>
              <button 
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  onEditHost(contextMenu.host!);
                  setContextMenu(null);
                }}
              >
                <Edit2 className="w-4 h-4 text-slate-400" />
                Edit Profile
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  const host = contextMenu.host!;
                  const tabId = uuidv4();
                  addTab(tabId, {
                    tabId: uuidv4(),
                    sessionId: null,
                    hostId: host.id,
                    label: `SFTP: ${host.label || host.hostname}`,
                    connected: false,
                    type: "sftp",
                  });
                  setContextMenu(null);
                }}
              >
                <FolderOpen className="w-4 h-4 text-slate-400" />
                Open SFTP
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 hover:text-red-300"
                onClick={() => {
                  handleDelete(contextMenu.host!);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="w-4 h-4 text-red-400/80" />
                Delete Host
              </button>
            </>
          )}
          {contextMenu.group && (
            <>
              <button 
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  onEditGroup(contextMenu.group!);
                  setContextMenu(null);
                }}
              >
                <Edit2 className="w-4 h-4 text-slate-400" />
                Edit Group
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 hover:text-red-300"
                onClick={() => {
                  handleDeleteGroup(contextMenu.group!);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="w-4 h-4 text-red-400/80" />
                Delete Group
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
