import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../store/useStore";
import { normalizeDistroId } from "../utils/distroIcon";
import SSHErrorOverlay, { SSHErrorType } from "./SSHErrorOverlay";
import LoadingScreen from "./LoadingScreen";
import { Code, Search, Send, X, Terminal as TerminalIcon } from "lucide-react";
import {
  getTerminalInstance,
  setTerminalInstance,
  destroyTerminalInstance,
  hasTerminalInstance,
  type TerminalInstance,
} from "../lib/terminalManager";

interface TerminalTabProps {
  readonly tabId: string;
  readonly hostId: string;
  readonly onEditHost: (host: any) => void;
  readonly onClose: () => void;
}

export default function TerminalTab({ tabId, hostId, onEditHost, onClose }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connecting, setConnecting] = useState(() => !hasTerminalInstance(tabId));
  const [sshError, setSshError] = useState<{ type: SSHErrorType; message: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState("");

  const setTabSessionId = useStore((s) => s.setTabSessionId);
  const { hosts, updateHost, snippets } = useStore();

  const host = hosts.find(h => h.id === hostId);

  // Get terminal instance ref for use in callbacks
  const getInstanceRef = useCallback(() => getTerminalInstance(tabId), [tabId]);

  // Re-fit terminal when sidebar toggles
  useEffect(() => {
    const instance = getInstanceRef();
    if (instance) {
      setTimeout(() => instance.fitAddon.fit(), 300);
    }
  }, [isSidebarOpen, getInstanceRef]);

  // Auto-focus terminal when dragging ends
  const isDraggingTabGlobal = useStore((s) => s.isDraggingTab);
  useEffect(() => {
    if (!isDraggingTabGlobal) {
      const instance = getInstanceRef();
      if (instance) instance.terminal.focus();
    }
  }, [isDraggingTabGlobal, getInstanceRef]);

  useEffect(() => {
    if (!containerRef.current) return;

    const existing = getTerminalInstance(tabId);

    if (existing) {
      // Reattach existing terminal DOM element to new container
      containerRef.current.appendChild(existing.element);
      requestAnimationFrame(() => existing.fitAddon.fit());
      existing.terminal.focus();
      return () => {
        // Detach but don't destroy - terminal survives across layout changes
        if (existing.element.parentNode) {
          existing.element.parentNode.removeChild(existing.element);
        }
      };
    }

    // Create new terminal instance
    const wrapperEl = document.createElement("div");
    wrapperEl.style.width = "100%";
    wrapperEl.style.height = "100%";
    containerRef.current.appendChild(wrapperEl);

    const term = new Terminal({
      theme: {
        background: "#0f1117",
        foreground: "#e0e0e0",
        cursor: "#528bff",
        selectionBackground: "#3a3f55",
        black: "#1e2130",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(wrapperEl);
    requestAnimationFrame(() => fit.fit());

    const instance: TerminalInstance = {
      terminal: term,
      fitAddon: fit,
      sessionId: null,
      element: wrapperEl,
    };

    // Send input to sidecar
    term.onData((data) => {
      if (instance.sessionId) {
        invoke("send_input", {
          sessionId: instance.sessionId,
          data,
        }).catch((err) =>
          console.error("[TerminalTab] send_input error:", err),
        );
      }
    });

    const startTime = Date.now();
    const minLoadingTime = 1500;
    let firstData = true;

    // Register listener for SSH output
    const unlistenPromise = listen<{ sessionId: string; data: string }>(
      "ssh-output",
      (event) => {
        if (
          instance.sessionId &&
          event.payload.sessionId === instance.sessionId
        ) {
          const data = event.payload.data;
          term.write(data);

          if (data.includes("[Error]")) {
            const errorMsg = data.split("[Error]")[1]?.trim() || "Unknown error";
            let type: SSHErrorType = 'generic';
            if (errorMsg.includes("Authentication failed")) type = 'auth';
            else if (errorMsg.includes("private key format") || errorMsg.includes("passphrase")) type = 'key';
            setSshError({ type, message: errorMsg });
            setConnecting(false);
          } else if (data.includes("[Connection closed]")) {
            setSshError({ type: 'disconnected', message: 'The SSH connection was dropped unexpectedly.' });
          }

          if (firstData && !sshError) {
            firstData = false;
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, minLoadingTime - elapsed);
            setTimeout(() => {
              setConnecting(false);
              requestAnimationFrame(() => fit.fit());
            }, remaining);
          }
        }
      },
    );

    unlistenPromise.then((fn) => {
      instance.unlisten = fn;
    });

    const setupConnection = async () => {
      try {
        setSshError(null);
        setConnecting(true);
        const sessionId = await invoke<string>("connect_host", { hostId });
        instance.sessionId = sessionId;
        setTabSessionId(tabId, sessionId);
        term.clear();

        // Auto-detect distro in background and update lastConnected
        const rawId = await invoke<string>("detect_distro", { hostId });
        const currentHost = hosts.find((h) => h.id === hostId);
        if (currentHost) {
          let updatedHost = { ...currentHost, lastConnected: Date.now() };
          if (rawId) {
            const iconKey = normalizeDistroId(rawId);
            if (currentHost.osIcon !== iconKey) {
              updatedHost.osIcon = iconKey;
            }
          }
          updateHost(updatedHost);
          await invoke("save_host", { profile: updatedHost });
        }
      } catch (err) {
        console.error("[TerminalTab] Connection failed:", err);
        setConnecting(false);
        const errMsg = String(err);
        let type: SSHErrorType = 'generic';
        if (errMsg.includes("timed out") || errMsg.includes("unreachable")) type = 'timeout';
        else if (errMsg.includes("Authentication")) type = 'auth';

        setSshError({ type, message: errMsg });
        term.write(`\r\n\x1b[31mConnection failed: ${errMsg}\x1b[0m\r\n`);
      }
    };

    setupConnection();

    // Handle resize
    const handleResize = () => fit.fit();
    window.addEventListener("resize", handleResize);
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(containerRef.current);

    instance.resizeCleanup = () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };

    // Sync PTY size with xterm.js
    term.onResize(({ cols, rows }) => {
      if (instance.sessionId) {
        invoke("resize_terminal", {
          sessionId: instance.sessionId,
          cols: Math.floor(cols),
          rows: Math.floor(rows),
        }).catch((err) =>
          console.error("[TerminalTab] resize_terminal error:", err),
        );
      }
    });

    // Store in manager
    setTerminalInstance(tabId, instance);

    return () => {
      // Detach but don't destroy - terminal survives across layout changes
      if (wrapperEl.parentNode) {
        wrapperEl.parentNode.removeChild(wrapperEl);
      }
    };
  }, [tabId, hostId]);

  // Handle explicit reconnect
  const handleReconnect = useCallback(() => {
    setSshError(null);
    const instance = getTerminalInstance(tabId);
    if (instance) {
      // Disconnect old session
      if (instance.sessionId) {
        invoke("disconnect_host", { sessionId: instance.sessionId }).catch(() => {});
      }
      // Destroy old instance fully and let useEffect recreate
      destroyTerminalInstance(tabId);
    }
    // Force re-render to trigger useEffect
    setConnecting(true);
  }, [tabId]);

  // Handle close - actually destroy the terminal
  const handleClose = useCallback(() => {
    const instance = getTerminalInstance(tabId);
    if (instance?.sessionId) {
      invoke("disconnect_host", { sessionId: instance.sessionId }).catch(() => {});
    }
    destroyTerminalInstance(tabId);
    onClose();
  }, [tabId, onClose]);

  const insertSnippet = (content: string) => {
    const instance = getTerminalInstance(tabId);
    if (instance?.sessionId) {
      const data = content.endsWith("\n") || content.endsWith("\r")
        ? content
        : content + "\n";
      invoke("send_input", {
        sessionId: instance.sessionId,
        data
      }).catch(console.error);
    }
  };

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      {connecting && <LoadingScreen host={host} onCancel={handleClose} />}

      {sshError && host && (
        <SSHErrorOverlay
          errorType={sshError.type}
          errorMessage={sshError.message}
          hostName={host.label || host.hostname}
          onReconnect={handleReconnect}
          onEditHost={() => onEditHost(host)}
          onCloseTab={handleClose}
        />
      )}

      {/* Terminal Area */}
      <div className="flex-1 min-w-0 relative">
        <div
          ref={containerRef}
          onClick={() => getTerminalInstance(tabId)?.terminal.focus()}
          className={`w-full h-full p-1 transition-opacity duration-500 ${connecting ? "opacity-0 invisible" : "opacity-100 visible"}`}
          style={{ backgroundColor: "#0f1117" }}
        />

        {/* Snippet Toggle Button */}
        {!connecting && !sshError && (
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute top-4 right-4 p-2.5 rounded-xl transition-all shadow-xl z-20 overflow-hidden ${
              isSidebarOpen
                ? "bg-blue-600 text-white"
                : "bg-[#1e2130]/80 text-gray-400 hover:text-white hover:bg-blue-600/40 backdrop-blur-md border border-white/5"
            }`}
            title="Snippets Sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Code className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Right Sidebar */}
      <div
        className={`bg-[#1e2130]/90 backdrop-blur-xl border-l border-white/10 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarOpen ? "w-80" : "w-0 opacity-0 border-none"
        }`}
      >
        <div className="p-4 border-b border-white/5 shrink-0">
          <h3 className="text-white font-bold flex items-center gap-2 mb-3">
            <TerminalIcon className="w-4 h-4 text-blue-400" />
            Quick Snippets
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search snippets..."
              value={snippetSearch}
              onChange={(e) => setSnippetSearch(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/5 focus:border-blue-500/50 rounded-lg py-1.5 pl-9 pr-3 text-xs text-white outline-none transition-all placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {snippets
            .filter(s => s.name.toLowerCase().includes(snippetSearch.toLowerCase()) || s.tags?.toLowerCase().includes(snippetSearch.toLowerCase()))
            .map(snippet => (
              <button
                key={snippet.id}
                onClick={() => insertSnippet(snippet.content)}
                className="w-full text-left p-3 rounded-xl hover:bg-white/5 group transition-colors flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold truncate group-hover:text-blue-400 transition-colors">
                    {snippet.name}
                  </div>
                  <div className="text-gray-500 text-[10px] font-mono mt-1 opacity-80 group-hover:opacity-100 line-clamp-2 break-all">
                    {snippet.content}
                  </div>
                </div>
                <Send className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 mt-1 transition-colors" />
              </button>
            ))
          }
          {snippets.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-xs">No snippets saved yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
