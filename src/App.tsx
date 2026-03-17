import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, HostProfile, SSHKey, Group } from "./store/useStore";
import Sidebar from "./components/Sidebar";
import TerminalTab from "./components/TerminalTab";
import AddHostModal from "./components/AddHostModal";
import AddGroupModal from "./components/AddGroupModal";
import Dashboard from "./components/Dashboard";
import NewActionModal from "./components/NewActionModal";
import KeysScreen from "./components/KeysScreen";
import AddKeyModal from "./components/AddKeyModal";
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Cloud,
  ChevronDown,
  Server,
  Copy,
  Type,
  X,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function App() {
  const {
    tabs,
    activeTabId,
    setHosts,
    setKeys,
    setActiveTab,
    removeTab,
    markDisconnected,
    addTab,
    renameTab,
    vaults,
    activeVaultId,
    dashboardViewMode,
    setDashboardViewMode,
    setGroups,
    sidebarView,
  } = useStore();
  const [showAddHost, setShowAddHost] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [showNewActionModal, setShowNewActionModal] = useState(false);
  const [editHost, setEditHost] = useState<HostProfile | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);

  const activeVault = vaults.find((v) => v.id === activeVaultId) || vaults[0];

  // Monitor Window Resize for Fullscreen Status
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const checkFullscreen = async () => {
      try {
        setIsFullscreen(await appWindow.isFullscreen());
      } catch (e) {
        // Fallback for non-Tauri contexts if any
      }
    };

    checkFullscreen();
    const unlistenResize = appWindow.onResized(checkFullscreen);

    return () => {
      unlistenResize.then((f) => f());
    };
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setTabContextMenu(null);
    globalThis.addEventListener("click", handleClick);
    return () => globalThis.removeEventListener("click", handleClick);
  }, []);

  // Load hosts, keys, and groups on mount
  useEffect(() => {
    invoke<HostProfile[]>("list_hosts").then(setHosts).catch(console.error);
    invoke<SSHKey[]>("list_keys").then(setKeys).catch(console.error);
    invoke<Group[]>("list_groups").then(setGroups).catch(console.error);
  }, []);

  // Listen for SSH disconnect events
  useEffect(() => {
    const unlistenDisconnect = listen<{ sessionId: string }>(
      "ssh-disconnected",
      (event) => {
        markDisconnected(event.payload.sessionId);
      },
    );
    return () => {
      unlistenDisconnect.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-space-dark text-slate-100 font-sans overflow-hidden">
      {/* True Application Title Bar (Overlay) */}
      <div
        data-tauri-drag-region
        className={`h-10 flex items-end pr-4 bg-[#202638] shrink-0 border-b border-slate-800 transition-all duration-300 ${isFullscreen ? "pl-4" : "pl-[84px]"}`}
      >
        {/* Vault Tab Design */}
        <div 
          className={`flex items-end shrink-0 h-full relative group ${activeTabId === null ? 'tab-curve-active z-20' : 'z-10'}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className={`flex items-center -space-x-px transition-all ${activeTabId === null ? 'h-full px-2' : 'h-8 mb-0.5 px-1'}`}>
            <button 
              onClick={() => setActiveTab(null)}
              className={`flex items-center gap-2 px-3 h-full cursor-pointer transition-colors text-sm font-medium ${activeTabId === null ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Cloud className={`w-4 h-4 transition-colors ${activeTabId === null ? 'text-blue-400' : 'text-slate-500'}`} />
              <span className="truncate">{activeVault?.name || "Main Vault"}</span>
            </button>
            <button className={`flex items-center justify-center px-1.5 h-full cursor-pointer transition-colors ${activeTabId === null ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs inside Title bar */}
        <div className="flex-1 flex justify-start h-full relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-end space-x-1 px-4 overflow-x-auto no-scrollbar h-full">
            {tabs.map((tab) => {
              const isActive = tab.tabId === activeTabId;
              let statusColor = "text-slate-500";
              if (isActive) {
                statusColor = tab.connected ? "text-green-500" : "text-orange-400";
              }

              return (
                <div
                  key={tab.tabId}
                  onClick={() => setActiveTab(tab.tabId)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      tabId: tab.tabId,
                    });
                  }}
                  className={`group relative flex items-center gap-2 px-5 cursor-pointer text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "tab-curve-active text-white"
                      : "text-slate-400 hover:text-slate-200 h-8 mb-0.5"
                  }`}
                >
                  <Server className={`w-3.5 h-3.5 ${statusColor}`} />
                  {renamingTabId === tab.tabId ? (
                    <input
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      className="bg-[#1a1f2e] border border-blue-500/50 outline-none text-white text-xs font-medium w-full max-w-40 px-1.5 py-0.5 rounded shadow-inner"
                      defaultValue={tab.label}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) renameTab(tab.tabId, val);
                        setRenamingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = e.currentTarget.value.trim();
                          if (val) renameTab(tab.tabId, val);
                          setRenamingTabId(null);
                        } else if (e.key === "Escape") {
                          setRenamingTabId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate max-w-40">{tab.label}</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tab.sessionId) {
                        invoke("disconnect_host", { sessionId: tab.sessionId }).catch(() => {});
                      }
                      removeTab(tab.tabId);
                    }}
                    className={`ml-1 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-slate-500 hover:text-white`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {tabs.length > 0 && (
              <button className="flex items-center justify-center p-1.5 text-slate-500 hover:text-white mb-1.5 ml-1 hover:bg-slate-800 rounded-md transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Context Menu */}
        {tabContextMenu && (
          <div
            className="fixed bg-[#1a1f2e] border border-slate-700 shadow-2xl rounded-lg py-1.5 w-48 z-50 overflow-hidden"
            style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-3 transition-colors"
              onClick={() => {
                const sourceTab = tabs.find((t) => t.tabId === tabContextMenu.tabId);
                if (sourceTab) {
                  // Get the base label (remove existing (n) if present)
                  const labelRegex = /^(.*?) \((\d+)\)$/;
                  const match = labelRegex.exec(sourceTab.label);
                  const baseLabel = match ? match[1] : sourceTab.label;
                  
                  // Find the highest n for this baseLabel
                  let maxN = 0;
                  const escapedBase = baseLabel.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
                  const tabRegex = new RegExp(String.raw`^${escapedBase} \((\d+)\)$`);

                  tabs.forEach(t => {
                    const tMatch = tabRegex.exec(t.label);
                    if (tMatch) {
                      const n = Number.parseInt(tMatch[1], 10);
                      if (n > maxN) maxN = n;
                    }
                  });

                  addTab({
                    ...sourceTab,
                    tabId: uuidv4(),
                    sessionId: null,
                    connected: false,
                    label: `${baseLabel} (${maxN + 1})`,
                  });
                }
                setTabContextMenu(null);
              }}
            >
              <Copy className="w-4 h-4" />
              Duplicate Tab
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-3 transition-colors"
              onClick={() => {
                setRenamingTabId(tabContextMenu.tabId);
                setTabContextMenu(null);
              }}
            >
              <Type className="w-4 h-4" />
              Rename Session
            </button>
            <div className="my-1 border-t border-slate-800" />
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
              onClick={() => {
                const tab = tabs.find((t) => t.tabId === tabContextMenu.tabId);
                if (tab) {
                  if (tab.sessionId) {
                    invoke("disconnect_host", { sessionId: tab.sessionId }).catch(() => {});
                  }
                  removeTab(tab.tabId);
                }
                setTabContextMenu(null);
              }}
            >
              <X className="w-4 h-4" />
              Close Session
            </button>
          </div>
        )}
      </div>

      {/* Main App Row */}
      <div className="flex flex-1 overflow-hidden">
        {activeTabId === null && (
          <Sidebar
            onAddHost={() => {
              setEditHost(null);
              setShowAddHost(true);
            }}
            onEditHost={(host) => {
              setEditHost(host);
              setShowAddHost(true);
            }}
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top Bar for Dashboard */}
          {activeTabId === null && (
            <header className="h-16 flex items-center justify-between px-8 bg-space-dark border-b border-slate-800 shrink-0">
              <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="w-full bg-slate-900 border-slate-800 text-slate-200 text-sm rounded-lg pl-10 focus:ring-accent-blue focus:border-accent-blue py-2"
                    placeholder="Search hosts, tags, or IP addresses..."
                    type="text"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
                  <button 
                    onClick={() => setDashboardViewMode("grid")}
                    className={`p-1.5 rounded transition-all ${dashboardViewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDashboardViewMode("list")}
                    className={`p-1.5 rounded transition-all ${dashboardViewMode === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowNewActionModal(true)}
                  className="bg-accent-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New</span>
                </button>
              </div>
            </header>
          )}

          {/* Terminal area */}
          <div className="flex-1 relative overflow-hidden">
            {tabs.map((tab) => (
              <div
                key={tab.tabId}
                className={`absolute inset-0 ${
                  tab.tabId === activeTabId ? "block" : "hidden"
                }`}
              >
                <TerminalTab tabId={tab.tabId} hostId={tab.hostId} />
              </div>
            ))}

            {activeTabId === null && sidebarView === "hosts" && (
              <Dashboard 
                onEditHost={(host) => {
                  setEditHost(host);
                  setShowAddHost(true);
                }}
                onAddHost={() => {
                  setEditHost(null);
                  setShowAddHost(true);
                }}
                onAddGroup={() => {
                  setEditGroup(null);
                  setShowAddGroup(true);
                }}
                onEditGroup={(group) => {
                  setEditGroup(group);
                  setShowAddGroup(true);
                }}
              />
            )}
            
            {activeTabId === null && sidebarView === "keys" && (
              <KeysScreen onAddKey={() => setShowAddKey(true)} />
            )}
          </div>
        </main>
      </div>

      {showAddHost && (
        <AddHostModal host={editHost} onClose={() => setShowAddHost(false)} />
      )}

      {showAddGroup && (
        <AddGroupModal 
          group={editGroup || undefined} 
          onClose={() => {
            setShowAddGroup(false);
            setEditGroup(null);
          }} 
        />
      )}

      {showNewActionModal && (
        <NewActionModal 
          onClose={() => setShowNewActionModal(false)}
          onAddHost={() => {
            setShowNewActionModal(false);
            setEditHost(null);
            setShowAddHost(true);
          }}
          onAddGroup={() => {
            setShowNewActionModal(false);
            setEditGroup(null);
            setShowAddGroup(true);
          }}
          onAddKey={() => {
            setShowNewActionModal(false);
            setShowAddKey(true);
          }}
        />
      )}

      {showAddKey && (
        <AddKeyModal onClose={() => setShowAddKey(false)} />
      )}
    </div>
  );
}
