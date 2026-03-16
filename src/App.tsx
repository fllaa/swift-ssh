import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, HostProfile, SSHKey } from "./store/useStore";
import Sidebar from "./components/Sidebar";
import TerminalTab from "./components/TerminalTab";
import AddHostModal from "./components/AddHostModal";
import Dashboard from "./components/Dashboard";
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Cloud,
  ChevronDown,
  Server,
  Bell,
} from "lucide-react";

export default function App() {
  const {
    tabs,
    activeTabId,
    setHosts,
    setKeys,
    setActiveTab,
    removeTab,
    markDisconnected,
    vaults,
    activeVaultId,
  } = useStore();
  const [showAddHost, setShowAddHost] = useState(false);
  const [editHost, setEditHost] = useState<HostProfile | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Load hosts and keys on mount
  useEffect(() => {
    invoke<HostProfile[]>("list_hosts").then(setHosts).catch(console.error);
    invoke<SSHKey[]>("list_keys").then(setKeys).catch(console.error);
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
        className={`h-10 flex items-center pr-4 bg-[#0B1021] shrink-0 border-b border-slate-800 transition-all duration-300 ${isFullscreen ? "pl-4" : "pl-[84px]"}`}
      >
        {/* Vault Dropdown */}
        <div className="flex items-center space-x-2 px-3 py-1 bg-card-slate rounded-md cursor-pointer border border-slate-700 hover:border-slate-500 transition-colors text-sm font-medium shrink-0">
          <Cloud className="w-4 h-4 text-slate-400" />
          <span>{activeVault?.name || "Main Vault"}</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        {/* Separator inside Title bar */}
        {tabs.length > 0 && (
          <div className="w-px h-4 bg-slate-700 mx-3 shrink-0" />
        )}

        {/* Tabs inside Title bar */}
        <div className="flex-1 flex overflow-x-auto items-center space-x-1 relative no-scrollbar" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {tabs.map((tab) => (
            <div
              key={tab.tabId}
              onClick={() => setActiveTab(tab.tabId)}
              className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-sm rounded-md shrink-0 transition-all ${
                tab.tabId === activeTabId
                  ? "bg-slate-700/40 text-white border border-slate-700/50"
                  : "bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Server className={`w-3.5 h-3.5 ${tab.connected ? 'text-green-500' : 'text-orange-400'}`} />
              <span className="truncate max-w-[120px]">{tab.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tab.sessionId) {
                    invoke("disconnect_host", { sessionId: tab.sessionId }).catch(() => {});
                  }
                  removeTab(tab.tabId);
                }}
                className="ml-1 text-slate-500 hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
          {tabs.length > 0 && (
            <button className="flex items-center justify-center p-1 text-slate-500 hover:text-white ml-1">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-3 shrink-0 ml-4">
          <Bell className="w-4 h-4 text-slate-500 hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Main App Row */}
      <div className="flex flex-1 overflow-hidden">
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

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top Bar for Dashboard */}
          {tabs.length === 0 && (
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
                  <button className="p-1.5 rounded bg-slate-800 text-white">
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded text-slate-500 hover:text-white">
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEditHost(null);
                    setShowAddHost(true);
                  }}
                  className="bg-accent-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Host</span>
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

            {tabs.length === 0 && <Dashboard />}
          </div>
        </main>
      </div>

      {showAddHost && (
        <AddHostModal host={editHost} onClose={() => setShowAddHost(false)} />
      )}
    </div>
  );
}
