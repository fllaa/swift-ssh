import { v4 as uuidv4 } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import { useStore, HostProfile } from "../store/useStore";

interface HostListProps {
  onAddHost: () => void;
  onEditHost: (host: HostProfile) => void;
}

export default function HostList({ onAddHost, onEditHost }: HostListProps) {
  const { hosts, removeHost, addTab } = useStore();

  const handleConnect = (host: HostProfile) => {
    // Create the tab first — TerminalTab will initiate the actual SSH connection
    // after its event listener is registered, avoiding the race condition
    const tabId = uuidv4();
    addTab({
      tabId,
      sessionId: null,
      hostId: host.id,
      label: host.label || `${host.username}@${host.hostname}`,
      connected: false,
      type: "terminal",
    });
  };

  const handleDelete = async (host: HostProfile) => {
    if (!confirm(`Delete host "${host.label}"?`)) return;
    try {
      await invoke("delete_host", { hostId: host.id });
      removeHost(host.id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="p-2">
      {hosts.map((host) => (
        <div
          key={host.id}
          className="group flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#282b3e] mb-1"
        >
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => handleConnect(host)}
          >
            <div className="text-sm text-white font-medium truncate">
              {host.label}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {host.username}@{host.hostname}:{host.port}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onEditHost(host)}
              className="text-gray-400 hover:text-white text-xs px-1"
              title="Edit"
            >
              ✎
            </button>
            <button
              onClick={() => handleDelete(host)}
              className="text-gray-400 hover:text-red-400 text-xs px-1"
              title="Delete"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {hosts.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-4">
          No hosts yet
        </p>
      )}

      <button
        onClick={onAddHost}
        className="w-full mt-2 py-2 rounded-md border border-dashed border-[#3a3f55] text-gray-400 text-sm hover:border-blue-500 hover:text-blue-400 transition-colors"
      >
        + Add Host
      </button>
    </div>
  );
}
