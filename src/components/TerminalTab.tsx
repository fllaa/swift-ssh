import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../store/useStore";
import { normalizeDistroId } from "../utils/distroIcon";
import SSHErrorOverlay, { SSHErrorType } from "./SSHErrorOverlay";
import LoadingScreen from "./LoadingScreen";
import { Terminal as TerminalIcon } from "lucide-react";
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


  const setTabSessionId = useStore((s) => s.setTabSessionId);
  const { hosts, updateHost } = useStore();

  const host = hosts.find(h => h.id === hostId);

  // Get terminal instance ref for use in callbacks
  const getInstanceRef = useCallback(() => getTerminalInstance(tabId), [tabId]);



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
        if (existing.element) {
          existing.element.remove();
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

    const addToHistory = useStore.getState().addToHistory;
    const commandBuffer = { current: "" };

    // Send input to sidecar
    term.onData((data) => {
      // Best-effort history capture
      for (const char of data) {
        if (char === "\r" || char === "\n") {
          if (commandBuffer.current.trim()) {
            addToHistory(commandBuffer.current.trim());
          }
          commandBuffer.current = "";
        } else if (char === "\x7f") { // Backspace
          commandBuffer.current = commandBuffer.current.slice(0, -1);
        } else if ((char.codePointAt(0) ?? 0) >= 32) { // Printable
          commandBuffer.current += char;
        }
      }

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
      if (wrapperEl) {
        wrapperEl.remove();
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
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Title Bar */}
        {!connecting && !sshError && (
          <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-[#0f1117]/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Terminal</span>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          onClick={() => getTerminalInstance(tabId)?.terminal.focus()}
          className={`flex-1 w-full p-1 transition-opacity duration-500 ${connecting ? "opacity-0 invisible" : "opacity-100 visible"}`}
          style={{ backgroundColor: "#0f1117" }}
        />
      </div>
    </div>
  );
}
