import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../store/useStore";

interface TerminalTabProps {
  tabId: string;
  hostId: string;
}

export default function TerminalTab({ tabId, hostId }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const setTabSessionId = useStore((s) => s.setTabSessionId);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log(`[TerminalTab] useEffect running, tabId=${tabId}, hostId=${hostId}`);

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
        }).catch((err) => console.error("[TerminalTab] send_input error:", err));
      }
    });

    term.write("Connecting...\r\n");

    // Register listener for SSH output
    const unlistenPromise = listen<{ sessionId: string; data: string }>(
      "ssh-output",
      (event) => {
        if (
          sessionIdRef.current &&
          event.payload.sessionId === sessionIdRef.current
        ) {
          term.write(event.payload.data);
        }
      }
    );

    // Initiate connection immediately — don't wait for listen() to resolve.
    // The SSH handshake takes 1-2 seconds, so the listener will be registered
    // long before any data arrives from the sidecar.
    console.log(`[TerminalTab] invoking connect_host for hostId=${hostId}`);
    invoke<string>("connect_host", { hostId })
      .then((sessionId) => {
        console.log(`[TerminalTab] connected, sessionId=${sessionId}`);
        sessionIdRef.current = sessionId;
        setTabSessionId(tabId, sessionId);
        term.clear();
      })
      .catch((err) => {
        console.error("[TerminalTab] connect failed:", err);
        term.write(`\r\n\x1b[31mConnection failed: ${err}\x1b[0m\r\n`);
      });

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
          () => {}
        );
      }
    };
  }, [tabId, hostId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: "#0f1117" }}
    />
  );
}
