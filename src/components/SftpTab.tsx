import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore, type FileEntry, type Transfer } from "../store/useStore";
import { SftpClient } from "../utils/sftpClient";
import FileBrowserPane from "./FileBrowserPane";
import TransferQueue from "./TransferQueue";
import { Loader2, Unplug } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface SftpTabProps {
  tabId: string;
  hostId: string;
}

export default function SftpTab({ tabId, hostId }: SftpTabProps) {
  const { setTabSessionId, markDisconnected, addTransfer, updateTransfer } =
    useStore();

  const clientRef = useRef<SftpClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);

  // Local state
  const [localPath, setLocalPath] = useState("");
  const [localEntries, setLocalEntries] = useState<FileEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  // Remote state
  const [remotePath, setRemotePath] = useState("");
  const [remoteEntries, setRemoteEntries] = useState<FileEntry[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteSelected, setRemoteSelected] = useState<Set<string>>(
    new Set()
  );

  // Divider
  const [dividerPos, setDividerPos] = useState(50);
  const dividerDragging = useRef(false);

  // ── List local directory ──
  const listLocal = useCallback(async (path: string) => {
    setLocalLoading(true);
    setLocalSelected(new Set());
    try {
      const result = await invoke<{ path: string; entries: FileEntry[] }>(
        "list_local_dir",
        { path }
      );
      setLocalPath(result.path);
      setLocalEntries(result.entries);
    } catch (err) {
      console.error("[sftp] list local error:", err);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // ── List remote directory ──
  const listRemote = useCallback(async (path: string) => {
    const client = clientRef.current;
    if (!client) return;
    setRemoteLoading(true);
    setRemoteSelected(new Set());
    try {
      const result = await client.listDir(path);
      setRemotePath(result.path);
      setRemoteEntries(result.entries);
    } catch (err) {
      console.error("[sftp] list remote error:", err);
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  // ── Connect on mount ──
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        // Get local home dir
        const homeDir = await invoke<string>("get_home_dir");
        if (!cancelled) {
          listLocal(homeDir);
        }

        // Connect SFTP
        const sessionId = await invoke<string>("connect_sftp", { hostId });
        if (cancelled) {
          invoke("disconnect_sftp", { sessionId }).catch(() => {});
          return;
        }

        sessionIdRef.current = sessionId;
        setTabSessionId(tabId, sessionId);

        // Create SFTP client
        const client = new SftpClient(sessionId);
        await client.init();
        clientRef.current = client;

        // Wait for connected status
        const unlistenConnected = await listen<{ sessionId: string }>(
          "sftp-connected",
          (event) => {
            if (event.payload.sessionId === sessionId) {
              setStatus("connected");
              // Update lastConnected timestamp
              const currentHost = useStore.getState().hosts.find(h => h.id === hostId);
              if (currentHost) {
                const updatedHost = { ...currentHost, lastConnected: Date.now() };
                useStore.getState().updateHost(updatedHost);
                invoke("save_host", { profile: updatedHost }).catch(console.error);
              }
            }
          }
        );

        // Listen for disconnect
        const unlistenDisconnected = await listen<{
          sessionId: string;
          error?: string;
        }>("sftp-disconnected", (event) => {
          if (event.payload.sessionId === sessionId) {
            setStatus("disconnected");
            if (event.payload.error) {
              setError(event.payload.error);
            }
            markDisconnected(sessionId);
          }
        });

        // Store cleanup functions
        (clientRef as any)._unlistenConnected = unlistenConnected;
        (clientRef as any)._unlistenDisconnected = unlistenDisconnected;

        // Get remote home and list it
        try {
          const remoteHome = await client.home();
          if (!cancelled) {
            listRemote(remoteHome);
          }
        } catch {
          if (!cancelled) {
            listRemote("/");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(String(err));
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      if (client) {
        client.destroy();
        (clientRef as any)?._unlistenConnected?.();
        (clientRef as any)?._unlistenDisconnected?.();
      }
      const sid = sessionIdRef.current;
      if (sid) {
        invoke("disconnect_sftp", { sessionId: sid }).catch(() => {});
      }
    };
  }, [hostId, tabId]);

  // ── Transfer handlers ──
  const handleUpload = useCallback(
    async (entries: FileEntry[]) => {
      const client = clientRef.current;
      if (!client) return;

      for (const entry of entries) {
        if (entry.isDir) continue; // skip dirs for now
        const localFilePath =
          localPath === "/"
            ? `/${entry.name}`
            : `${localPath}/${entry.name}`;
        const remoteFilePath =
          remotePath === "/"
            ? `/${entry.name}`
            : `${remotePath}/${entry.name}`;

        const transferId = uuidv4();
        const transfer: Transfer = {
          id: transferId,
          sessionId: sessionIdRef.current || "",
          direction: "upload",
          localPath: localFilePath,
          remotePath: remoteFilePath,
          fileName: entry.name,
          bytesTransferred: 0,
          totalBytes: entry.size,
          status: "active",
          startedAt: Date.now(),
        };
        addTransfer(transfer);

        try {
          await client.upload(localFilePath, remoteFilePath, (bytes, total) => {
            updateTransfer(transferId, {
              bytesTransferred: bytes,
              totalBytes: total,
            });
          });
          updateTransfer(transferId, { status: "completed", bytesTransferred: entry.size });
          listRemote(remotePath);
        } catch (err) {
          updateTransfer(transferId, {
            status: "failed",
            error: String(err),
          });
        }
      }
    },
    [localPath, remotePath, addTransfer, updateTransfer, listRemote]
  );

  const handleDownload = useCallback(
    async (entries: FileEntry[]) => {
      const client = clientRef.current;
      if (!client) return;

      for (const entry of entries) {
        if (entry.isDir) continue;
        const remoteFilePath =
          remotePath === "/"
            ? `/${entry.name}`
            : `${remotePath}/${entry.name}`;
        const localFilePath =
          localPath === "/"
            ? `/${entry.name}`
            : `${localPath}/${entry.name}`;

        const transferId = uuidv4();
        const transfer: Transfer = {
          id: transferId,
          sessionId: sessionIdRef.current || "",
          direction: "download",
          localPath: localFilePath,
          remotePath: remoteFilePath,
          fileName: entry.name,
          bytesTransferred: 0,
          totalBytes: entry.size,
          status: "active",
          startedAt: Date.now(),
        };
        addTransfer(transfer);

        try {
          await client.download(
            remoteFilePath,
            localFilePath,
            (bytes, total) => {
              updateTransfer(transferId, {
                bytesTransferred: bytes,
                totalBytes: total,
              });
            }
          );
          updateTransfer(transferId, { status: "completed", bytesTransferred: entry.size });
          listLocal(localPath);
        } catch (err) {
          updateTransfer(transferId, {
            status: "failed",
            error: String(err),
          });
        }
      }
    },
    [localPath, remotePath, addTransfer, updateTransfer, listLocal]
  );

  // ── Remote file operations ──
  const handleRemoteDelete = useCallback(
    async (entry: FileEntry) => {
      const client = clientRef.current;
      if (!client) return;
      const fullPath =
        remotePath === "/"
          ? `/${entry.name}`
          : `${remotePath}/${entry.name}`;
      try {
        if (entry.isDir) {
          await client.rmdir(fullPath);
        } else {
          await client.rm(fullPath);
        }
        listRemote(remotePath);
      } catch (err) {
        console.error("[sftp] delete error:", err);
      }
    },
    [remotePath, listRemote]
  );

  const handleRemoteRename = useCallback(
    async (entry: FileEntry, newName: string) => {
      const client = clientRef.current;
      if (!client) return;
      const oldPath =
        remotePath === "/"
          ? `/${entry.name}`
          : `${remotePath}/${entry.name}`;
      const newPath =
        remotePath === "/" ? `/${newName}` : `${remotePath}/${newName}`;
      try {
        await client.rename(oldPath, newPath);
        listRemote(remotePath);
      } catch (err) {
        console.error("[sftp] rename error:", err);
      }
    },
    [remotePath, listRemote]
  );

  const handleRemoteMkdir = useCallback(
    async (name: string) => {
      const client = clientRef.current;
      if (!client) return;
      const fullPath =
        remotePath === "/" ? `/${name}` : `${remotePath}/${name}`;
      try {
        await client.mkdir(fullPath);
        listRemote(remotePath);
      } catch (err) {
        console.error("[sftp] mkdir error:", err);
      }
    },
    [remotePath, listRemote]
  );

  // ── Local file operations ──
  const handleLocalMkdir = useCallback(
    async (name: string) => {
      // Use Rust to create local dir (we don't have a command for it, so we can use the list after)
      // For now, we'll skip local mkdir — future enhancement
      console.log("[sftp] local mkdir not implemented yet:", name);
    },
    []
  );

  // ── Divider drag ──
  const handleDividerMouseDown = useCallback(() => {
    dividerDragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dividerDragging.current) return;
      const container = document.getElementById(`sftp-container-${tabId}`);
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setDividerPos(Math.max(20, Math.min(80, pos)));
    };

    const handleMouseUp = () => {
      dividerDragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [tabId]);

  // ── Loading / Error states ──
  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-space-dark text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-sm">Connecting SFTP...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-space-dark text-slate-400 gap-3">
        <Unplug className="w-8 h-8 text-red-400" />
        <span className="text-sm text-red-400">Connection failed</span>
        {error && (
          <span className="text-xs text-slate-500 max-w-md text-center">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-space-dark">
      {/* Split pane container */}
      <div
        id={`sftp-container-${tabId}`}
        className="flex flex-1 overflow-hidden"
      >
        {/* Local pane */}
        <div style={{ width: `${dividerPos}%` }} className="min-w-0">
          <FileBrowserPane
            title="Local"
            entries={localEntries}
            currentPath={localPath}
            loading={localLoading}
            onNavigate={listLocal}
            onRefresh={() => listLocal(localPath)}
            selectedEntries={localSelected}
            onSelect={setLocalSelected}
            onTransfer={handleUpload}
            onMkdir={handleLocalMkdir}
          />
        </div>

        {/* Divider */}
        <div
          className="w-1 bg-slate-800 hover:bg-blue-500/50 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={handleDividerMouseDown}
        />

        {/* Remote pane */}
        <div
          style={{ width: `${100 - dividerPos}%` }}
          className="min-w-0"
        >
          <FileBrowserPane
            title="Remote"
            entries={remoteEntries}
            currentPath={remotePath}
            loading={remoteLoading}
            onNavigate={listRemote}
            onRefresh={() => listRemote(remotePath)}
            selectedEntries={remoteSelected}
            onSelect={setRemoteSelected}
            onTransfer={handleDownload}
            onDelete={handleRemoteDelete}
            onRename={handleRemoteRename}
            onMkdir={handleRemoteMkdir}
          />
        </div>
      </div>

      {/* Transfer queue */}
      <TransferQueue />

      {/* Disconnected banner */}
      {status === "disconnected" && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center">
          SFTP session disconnected
          {error && `: ${error}`}
        </div>
      )}
    </div>
  );
}
