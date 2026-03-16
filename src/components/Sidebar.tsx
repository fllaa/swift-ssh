import { useStore, HostProfile } from "../store/useStore";
import HostList from "./HostList";
import KeyManager from "./KeyManager";

interface SidebarProps {
  onAddHost: () => void;
  onEditHost: (host: HostProfile) => void;
}

export default function Sidebar({ onAddHost, onEditHost }: SidebarProps) {
  const { sidebarView, setSidebarView } = useStore();

  return (
    <div className="w-64 bg-[#1e2130] border-r border-[#2a2d3e] flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2d3e]">
        <h1 className="text-white font-semibold text-lg tracking-tight">
          SwiftSSH
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-[#2a2d3e]">
        <button
          onClick={() => setSidebarView("hosts")}
          className={`flex-1 py-2 text-xs font-medium tracking-wide uppercase ${
            sidebarView === "hosts"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Hosts
        </button>
        <button
          onClick={() => setSidebarView("keys")}
          className={`flex-1 py-2 text-xs font-medium tracking-wide uppercase ${
            sidebarView === "keys"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Keys
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarView === "hosts" ? (
          <HostList onAddHost={onAddHost} onEditHost={onEditHost} />
        ) : (
          <KeyManager />
        )}
      </div>
    </div>
  );
}
