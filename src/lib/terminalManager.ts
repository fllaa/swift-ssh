import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  sessionId: string | null;
  element: HTMLDivElement; // Wrapper div that holds xterm DOM
  unlisten?: () => void; // Cleanup for ssh-output listener
  resizeCleanup?: () => void; // Cleanup for resize observer/listener
}

const terminals = new Map<string, TerminalInstance>();

export function getTerminalInstance(tabId: string): TerminalInstance | undefined {
  return terminals.get(tabId);
}

export function setTerminalInstance(tabId: string, instance: TerminalInstance) {
  terminals.set(tabId, instance);
}

export function destroyTerminalInstance(tabId: string) {
  const instance = terminals.get(tabId);
  if (instance) {
    instance.unlisten?.();
    instance.resizeCleanup?.();
    instance.terminal.dispose();
    instance.element.remove();
    terminals.delete(tabId);
  }
}

export function hasTerminalInstance(tabId: string): boolean {
  return terminals.has(tabId);
}
