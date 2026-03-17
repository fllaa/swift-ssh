import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../store/useStore";
import { normalizeDistroId } from "../utils/distroIcon";
import SSHErrorOverlay, { SSHErrorType } from "./SSHErrorOverlay";
import LoadingScreen from "./LoadingScreen";

interface TerminalTabProps {
  readonly tabId: string;
  readonly hostId: string;
  readonly onEditHost: (host: any) => void;
  readonly onClose: () => void;
}

export default function TerminalTab({ tabId, hostId, onEditHost, onClose }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [sshError, setSshError] = useState<{ type: SSHErrorType; message: string } | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);
  const setTabSessionId = useStore((s) => s.setTabSessionId);
  const { hosts, updateHost } = useStore();

  const host = hosts.find(h => h.id === hostId);

  useEffect(() => {
    if (!containerRef.current) return;

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
    term.open(containerRef.current);
    requestAnimationFrame(() => fit.fit());

    termRef.current = term;

    // Send input to sidecar (only after connected)
    term.onData((data) => {
      if (sessionIdRef.current) {
        invoke("send_input", {
          sessionId: sessionIdRef.current,
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
          sessionIdRef.current &&
          event.payload.sessionId === sessionIdRef.current
        ) {
          const data = event.payload.data;
          term.write(data);

          // Check for errors or disconnection from bridge
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
              // Trigger a fit once visible
              requestAnimationFrame(() => fit.fit());
            }, remaining);
          }
        }
      },
    );

    const setupConnection = async () => {
      try {
        setSshError(null);
        setConnecting(true);
        const sessionId = await invoke<string>("connect_host", { hostId });
        sessionIdRef.current = sessionId;
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

    return () => {
      unlistenPromise.then((fn) => fn());
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      term.dispose();
      if (sessionIdRef.current) {
        invoke("disconnect_host", { sessionId: sessionIdRef.current }).catch(
          () => {},
        );
      }
    };
  }, [tabId, hostId, reconnectKey]);

  return (
    <div className="relative w-full h-full">
      {connecting && <LoadingScreen host={host} onCancel={onClose} />}
      
      {sshError && host && (
        <SSHErrorOverlay
          errorType={sshError.type}
          errorMessage={sshError.message}
          hostName={host.label || host.hostname}
          onReconnect={() => {
            setSshError(null);
            termRef.current?.clear();
            if (sessionIdRef.current) {
               invoke("disconnect_host", { sessionId: sessionIdRef.current }).catch(() => {});
            }
            // Trigger the useEffect again
            setReconnectKey((k) => k + 1);
          }}
          onEditHost={() => onEditHost(host)}
          onCloseTab={onClose}
        />
      )}

      <div
        ref={containerRef}
        className={`w-full h-full p-1 transition-opacity duration-500 ${connecting ? "opacity-0 invisible" : "opacity-100 visible"}`}
        style={{ backgroundColor: "#0f1117" }}
      />
    </div>
  );
}
