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
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  vaultId: string;
}

export interface Vault {
  id: string;
  name: string;
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
  groups: Group[];
  vaults: Vault[];
  activeVaultId: string | null;
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

  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  removeGroup: (id: string) => void;

  setVaults: (vaults: Vault[]) => void;
  addVault: (vault: Vault) => void;
  setActiveVaultId: (id: string) => void;

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
  groups: [
    { id: "g1", name: "AWS Production", vaultId: "v1" },
    { id: "g2", name: "Staging", vaultId: "v1" },
    { id: "g3", name: "Development", vaultId: "v1" },
  ],
  vaults: [{ id: "v1", name: "Main Vault" }],
  activeVaultId: "v1",
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

  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  setVaults: (vaults) => set({ vaults }),
  addVault: (vault) => set((s) => ({ vaults: [...s.vaults, vault] })),
  setActiveVaultId: (id) => set({ activeVaultId: id }),

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
