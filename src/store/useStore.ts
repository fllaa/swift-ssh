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
  jumpHostId?: string;
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
  tabId: string; // unique session ID
  sessionId: string | null; // SSH session ID from backend
  hostId: string;
  label: string;
  connected: boolean;
  type: "terminal" | "sftp";
}

export type LayoutNode =
  | { type: "pane"; sessionId: string } // Note: sessionId here is TabSession.tabId
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      first: LayoutNode;
      second: LayoutNode;
      splitRatio: number; // 0 to 100
    };

export interface TabGroup {
  id: string;
  label: string;
  layout: LayoutNode;
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
  tabs: TabGroup[]; // Top-level tabs
  activeTabId: string | null; // active TabGroup ID
  sessions: TabSession[]; // All active sessions across all tabs
  sidebarView: "hosts" | "keys" | "port-forwarding" | "snippets";
  dashboardViewMode: "grid" | "list";
  transfers: Transfer[];
  portForwardingRules: PortForwardingRule[];
  forwardingSessions: Record<string, string>; // hostId -> sessionId
  snippets: Snippet[];
  snippetsOpen: boolean;
  history: string[];

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

  // Tab management (TabGroups)
  addTab: (tabId: string, session: TabSession) => void;
  removeTab: (id: string) => void;
  removeTabOnly: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  activePaneId: string | null;
  setActivePaneId: (id: string | null) => void;
  updateTabLayout: (tabId: string, layout: LayoutNode) => void;
  isDraggingTab: boolean;
  setIsDraggingTab: (isDragging: boolean) => void;
  
  // Session management
  addSession: (session: TabSession) => void;
  removeSession: (tabId: string) => void;
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
  setSnippetsOpen: (open: boolean) => void;
  addToHistory: (command: string) => void;
}

export const useStore = create<AppState>((set) => ({
  hosts: [],
  keys: [],
  groups: [],
  vaults: [{ id: "v1", name: "Main Vault" }],
  activeVaultId: "v1",
  tabs: [],
  activeTabId: null,
  sessions: [],
  sidebarView: "hosts",
  dashboardViewMode: "grid",
  transfers: [],
  portForwardingRules: [],
  forwardingSessions: {},
  snippets: [],
  snippetsOpen: false,
  history: [],
  isDraggingTab: false,

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

  // Tab & Session management
  addTab: (tabId, session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      tabs: [
        ...s.tabs,
        {
          id: tabId,
          label: session.label,
          layout: { type: "pane", sessionId: session.tabId },
        },
      ],
      activeTabId: tabId,
    })),

  removeTab: (id) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return s;

      // Find all sessions in this tab's layout
      const getSessionIds = (node: LayoutNode): string[] => {
        if (node.type === "pane") return [node.sessionId];
        return [...getSessionIds(node.first), ...getSessionIds(node.second)];
      };
      const sessionIds = getSessionIds(tab.layout);

      const newTabs = s.tabs.filter((t) => t.id !== id);
      const newSessions = s.sessions.filter(
        (sess) => !sessionIds.includes(sess.tabId),
      );

      let nextActiveTabId = s.activeTabId;
      if (s.activeTabId === id) {
        nextActiveTabId =
          newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return {
        tabs: newTabs,
        sessions: newSessions,
        activeTabId: nextActiveTabId,
      };
    }),

  removeTabOnly: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id);
      let nextActiveTabId = s.activeTabId;
      if (s.activeTabId === id) {
        nextActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return {
        tabs: newTabs,
        activeTabId: nextActiveTabId,
      };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  
  activePaneId: null,
  setActivePaneId: (id) => set({ activePaneId: id }),
  
  updateTabLayout: (tabId, layout) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, layout } : t)),
    })),

  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),

  removeSession: (tabId) =>
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.tabId !== tabId) })),

  setTabSessionId: (tabId, sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.tabId === tabId ? { ...sess, sessionId, connected: true } : sess,
      ),
    })),

  markDisconnected: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.sessionId === sessionId ? { ...sess, connected: false } : sess,
      ),
    })),

  renameTab: (tabId, label) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.tabId === tabId ? { ...sess, label } : sess,
      ),
      tabs: s.tabs.map((t) => {
        // Find if this session is the primary one for the tab label?
        // For now, if a tab has multiple panes, renaming might be individual sessions.
        // But for backward compatibility, if session.tabId matches tab.id, rename tab too.
        if (t.id === tabId) return { ...t, label };
        return t;
      }),
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
  setSnippetsOpen: (snippetsOpen) => set({ snippetsOpen }),
  addToHistory: (command) =>
    set((s) => {
      const trimmed = command.trim();
      if (!trimmed) return s;

      // Remove existing item if present to ensure uniqueness and move to top
      const filtered = s.history.filter((h) => h !== trimmed);
      const newHistory = [trimmed, ...filtered].slice(0, 100);
      
      return { history: newHistory };
    }),
  setIsDraggingTab: (isDragging) => set({ isDraggingTab: isDragging }),
}));

// Helper to remove a sessionId from a layout and return the new layout
// or null if the layout becomes empty
export const removeFromLayout = (
  node: LayoutNode,
  sessionId: string,
): LayoutNode | null => {
  if (node.type === "pane") {
    return node.sessionId === sessionId ? null : node;
  }

  const newFirst = removeFromLayout(node.first, sessionId);
  const newSecond = removeFromLayout(node.second, sessionId);

  if (!newFirst) return newSecond;
  if (!newSecond) return newFirst;

  return { ...node, first: newFirst, second: newSecond };
};
