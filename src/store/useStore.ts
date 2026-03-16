import { create } from "zustand";

export interface HostProfile {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  keyId?: string;
}

export interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  privateKey: string;
}

export interface TabSession {
  tabId: string; // local tab ID (stable, used for UI)
  sessionId: string | null; // SSH session ID (set after connect)
  hostId: string;
  label: string;
  connected: boolean;
}

interface AppState {
  hosts: HostProfile[];
  keys: SSHKey[];
  tabs: TabSession[];
  activeTabId: string | null;
  sidebarView: "hosts" | "keys";

  setHosts: (hosts: HostProfile[]) => void;
  addHost: (host: HostProfile) => void;
  updateHost: (host: HostProfile) => void;
  removeHost: (id: string) => void;

  setKeys: (keys: SSHKey[]) => void;
  addKey: (key: SSHKey) => void;
  removeKey: (id: string) => void;

  addTab: (tab: TabSession) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  setTabSessionId: (tabId: string, sessionId: string) => void;
  markDisconnected: (sessionId: string) => void;

  setSidebarView: (view: "hosts" | "keys") => void;
}

export const useStore = create<AppState>((set) => ({
  hosts: [],
  keys: [],
  tabs: [],
  activeTabId: null,
  sidebarView: "hosts",

  setHosts: (hosts) => set({ hosts }),
  addHost: (host) => set((s) => ({ hosts: [...s.hosts, host] })),
  updateHost: (host) =>
    set((s) => ({ hosts: s.hosts.map((h) => (h.id === host.id ? host : h)) })),
  removeHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id) })),

  setKeys: (keys) => set({ keys }),
  addKey: (key) => set((s) => ({ keys: [...s.keys, key] })),
  removeKey: (id) => set((s) => ({ keys: s.keys.filter((k) => k.id !== id) })),

  addTab: (tab) => set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.tabId })),
  removeTab: (tabId) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.tabId !== tabId);
      return {
        tabs: newTabs,
        activeTabId:
          s.activeTabId === tabId
            ? newTabs.length > 0
              ? newTabs[newTabs.length - 1].tabId
              : null
            : s.activeTabId,
      };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setTabSessionId: (tabId, sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.tabId === tabId ? { ...t, sessionId, connected: true } : t
      ),
    })),
  markDisconnected: (sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.sessionId === sessionId ? { ...t, connected: false } : t
      ),
    })),

  setSidebarView: (view) => set({ sidebarView: view }),
}));
