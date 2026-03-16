import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore, HostProfile, SSHKey } from "./store/useStore";
import Sidebar from "./components/Sidebar";
import TerminalTab from "./components/TerminalTab";
import AddHostModal from "./components/AddHostModal";

export default function App() {
  const { tabs, activeTabId, setHosts, setKeys, setActiveTab, removeTab, markDisconnected } =
    useStore();
  const [showAddHost, setShowAddHost] = useState(false);
  const [editHost, setEditHost] = useState<HostProfile | null>(null);

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
      }
    );
    return () => {
      unlistenDisconnect.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex h-screen w-screen bg-[#0f1117]">
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
      <div className="flex flex-col flex-1 min-w-0">
        {/* Tab bar */}
        {tabs.length > 0 && (
          <div className="flex bg-[#161822] border-b border-[#2a2d3e] overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.tabId}
                onClick={() => setActiveTab(tab.tabId)}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer text-sm border-r border-[#2a2d3e] shrink-0 ${
                  tab.tabId === activeTabId
                    ? "bg-[#0f1117] text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#1e2130]"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    tab.connected
                      ? "bg-green-500"
                      : tab.sessionId === null
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="truncate max-w-[150px]">{tab.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tab.sessionId) {
                      invoke("disconnect_host", { sessionId: tab.sessionId }).catch(() => {});
                    }
                    removeTab(tab.tabId);
                  }}
                  className="ml-1 text-gray-500 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Terminal area */}
        <div className="flex-1 relative">
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

          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-5xl mb-4 opacity-30">⌘</div>
                <p className="text-lg">No active connections</p>
                <p className="text-sm mt-1">
                  Select a host from the sidebar to connect
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddHost && (
        <AddHostModal
          host={editHost}
          onClose={() => setShowAddHost(false)}
        />
      )}
    </div>
  );
}
