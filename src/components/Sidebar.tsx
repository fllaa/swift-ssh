import { useStore, HostProfile } from "../store/useStore";
import HostList from "./HostList";
import KeyManager from "./KeyManager";
import { Server, Key, Shuffle, Terminal, ShieldCheck, FileText } from "lucide-react";

interface SidebarProps {
  onAddHost: () => void;
  onEditHost: (host: HostProfile) => void;
}


export default function Sidebar({ onAddHost, onEditHost }: SidebarProps) {
  const { sidebarView, setSidebarView } = useStore();

  return (
    <aside className="w-64 bg-navy-sidebar shrink-0 flex flex-col border-r border-slate-800" data-purpose="navigation-sidebar">
      {/* Navigation Items */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
        <button
          onClick={() => setSidebarView("hosts")}
          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-r-md transition-all ${
            sidebarView === "hosts"
              ? "bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Hosts</span>
        </button>
        <button
          onClick={() => setSidebarView("keys")}
          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-r-md transition-all ${
            sidebarView === "keys"
              ? "bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Keychain</span>
        </button>
        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all">
          <Shuffle className="w-4 h-4" />
          <span>Port Forwarding</span>
        </button>
        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all">
          <Terminal className="w-4 h-4" />
          <span>Snippets</span>
        </button>
        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all">
          <ShieldCheck className="w-4 h-4" />
          <span>Known Hosts</span>
        </button>
        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all">
          <FileText className="w-4 h-4" />
          <span>Logs</span>
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>v2.4.1 Stable</span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
