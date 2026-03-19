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
  tags?: string;
  osIcon?: string;
  lastConnected?: number;
  agentForwarding?: boolean;
}

export interface PortForwardingRule {
  id: string;
  label: string;
  hostId: string;
  type: "local" | "remote";
  localPort: number;
  remoteHost: string; // e.g., "127.0.0.1"
  remotePort: number;
  enabled: boolean;
}

export interface Group {
  id: string;
  name: string;
  vaultId: string;
  icon?: string;
  color?: string;
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

export interface Snippet {
  id: string;
  name: string;
  content: string;
  description?: string;
  tags?: string;
}

export interface TabSession {
  tabId: string; // local tab ID (stable, used for UI)
  sessionId: string | null; // SSH session ID (set after connect)
  hostId: string;
  label: string;
  connected: boolean;
  type: "terminal" | "sftp";
}

export interface FileEntry {
  name: string;
  size: number;
  permissions: string;
  permStr: string;
  mtime: number;
  isDir: boolean;
  isSymlink: boolean;
}

export interface Transfer {
  id: string;
  sessionId: string;
  direction: "upload" | "download";
  localPath: string;
  remotePath: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  status: "queued" | "active" | "completed" | "failed" | "cancelled";
  error?: string;
  startedAt: number;
}

interface AppState {
  hosts: HostProfile[];
  keys: SSHKey[];
  groups: Group[];
  vaults: Vault[];
  activeVaultId: string | null;
  tabs: TabSession[];
  activeTabId: string | null;
  sidebarView: "hosts" | "keys" | "port-forwarding" | "snippets";
  dashboardViewMode: "grid" | "list";
  transfers: Transfer[];
  portForwardingRules: PortForwardingRule[];
  forwardingSessions: Record<string, string>; // hostId -> sessionId
  snippets: Snippet[];

  setHosts: (hosts: HostProfile[]) => void;
  addHost: (host: HostProfile) => void;
  updateHost: (host: HostProfile) => void;
  removeHost: (id: string) => void;

  setKeys: (keys: SSHKey[]) => void;
  addKey: (key: SSHKey) => void;
  removeKey: (id: string) => void;

  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  removeGroup: (id: string) => void;

  setVaults: (vaults: Vault[]) => void;
  addVault: (vault: Vault) => void;
  setActiveVaultId: (id: string) => void;

  addTab: (tab: TabSession) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  setTabSessionId: (tabId: string, sessionId: string) => void;
  markDisconnected: (sessionId: string) => void;

  renameTab: (tabId: string, label: string) => void;
  setSidebarView: (
    view: "hosts" | "keys" | "port-forwarding" | "snippets",
  ) => void;
  setDashboardViewMode: (mode: "grid" | "list") => void;

  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, update: Partial<Transfer>) => void;
  removeTransfer: (id: string) => void;
  clearCompletedTransfers: () => void;

  setPortForwardingRules: (rules: PortForwardingRule[]) => void;
  addPortForwardingRule: (rule: PortForwardingRule) => void;
  updatePortForwardingRule: (rule: PortForwardingRule) => void;
  removePortForwardingRule: (id: string) => void;
  setForwardingSession: (hostId: string, sessionId: string) => void;
  removeForwardingSession: (hostId: string) => void;

  setSnippets: (snippets: Snippet[]) => void;
  addSnippet: (snippet: Snippet) => void;
  updateSnippet: (snippet: Snippet) => void;
  removeSnippet: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  hosts: [],
  keys: [],
  groups: [],
  vaults: [{ id: "v1", name: "Main Vault" }],
  activeVaultId: "v1",
  tabs: [],
  activeTabId: null,
  sidebarView: "hosts",
  dashboardViewMode: "grid",
  transfers: [],
  portForwardingRules: [],
  forwardingSessions: {},
  snippets: [],

  setHosts: (hosts) => set({ hosts }),
  addHost: (host) => set((s) => ({ hosts: [...s.hosts, host] })),
  updateHost: (host) =>
    set((s) => ({ hosts: s.hosts.map((h) => (h.id === host.id ? host : h)) })),
  removeHost: (id) =>
    set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id) })),

  setKeys: (keys) => set({ keys }),
  addKey: (key) => set((s) => ({ keys: [...s.keys, key] })),
  removeKey: (id) => set((s) => ({ keys: s.keys.filter((k) => k.id !== id) })),

  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  updateGroup: (group) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === group.id ? group : g)),
    })),
  removeGroup: (id) =>
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  setVaults: (vaults) => set({ vaults }),
  addVault: (vault) => set((s) => ({ vaults: [...s.vaults, vault] })),
  setActiveVaultId: (id) => set({ activeVaultId: id }),

  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.tabId })),
  removeTab: (tabId) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.tabId !== tabId);
      let nextActiveTabId = s.activeTabId;
      if (s.activeTabId === tabId) {
        nextActiveTabId =
          newTabs.length > 0 ? newTabs[newTabs.length - 1].tabId : null;
      }
      return {
        tabs: newTabs,
        activeTabId: nextActiveTabId,
      };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setTabSessionId: (tabId, sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.tabId === tabId ? { ...t, sessionId, connected: true } : t,
      ),
    })),
  markDisconnected: (sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.sessionId === sessionId ? { ...t, connected: false } : t,
      ),
    })),

  renameTab: (tabId, label) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.tabId === tabId ? { ...t, label } : t)),
    })),
  setSidebarView: (view) => set({ sidebarView: view }),
  setDashboardViewMode: (mode) => set({ dashboardViewMode: mode }),

  addTransfer: (transfer) =>
    set((s) => ({ transfers: [...s.transfers, transfer] })),
  updateTransfer: (id, update) =>
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id ? { ...t, ...update } : t,
      ),
    })),
  removeTransfer: (id) =>
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) })),
  clearCompletedTransfers: () =>
    set((s) => ({
      transfers: s.transfers.filter(
        (t) => t.status !== "completed" && t.status !== "failed",
      ),
    })),

  setPortForwardingRules: (rules) => set({ portForwardingRules: rules }),
  addPortForwardingRule: (rule) =>
    set((s) => ({ portForwardingRules: [...s.portForwardingRules, rule] })),
  updatePortForwardingRule: (rule) =>
    set((s) => ({
      portForwardingRules: s.portForwardingRules.map((r) =>
        r.id === rule.id ? rule : r,
      ),
    })),
  removePortForwardingRule: (id) =>
    set((s) => ({
      portForwardingRules: s.portForwardingRules.filter((r) => r.id !== id),
    })),
  setForwardingSession: (hostId, sessionId) =>
    set((s) => ({
      forwardingSessions: { ...s.forwardingSessions, [hostId]: sessionId },
    })),
  removeForwardingSession: (hostId) =>
    set((s) => {
      const next = { ...s.forwardingSessions };
      delete next[hostId];
      return { forwardingSessions: next };
    }),

  setSnippets: (snippets) => set({ snippets }),
  addSnippet: (snippet) => set((s) => ({ snippets: [...s.snippets, snippet] })),
  updateSnippet: (snippet) =>
    set((s) => ({
      snippets: s.snippets.map((snip) =>
        snip.id === snippet.id ? snippet : snip,
      ),
    })),
  removeSnippet: (id) =>
    set((s) => ({ snippets: s.snippets.filter((snip) => snip.id !== id) })),
}));
