import { invoke } from "@tauri-apps/api/core";
import { useStore, LogCategory, LogEntry } from "../store/useStore";

export function logActivity(
  category: LogCategory,
  action: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    category,
    action,
    description,
    metadata,
  };
  const state = useStore.getState();
  state.addLog(entry);
  invoke("save_log", { log: entry, limit: state.settings.logRetentionLimit }).catch(
    console.error,
  );
}
