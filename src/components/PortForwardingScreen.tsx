import { invoke } from "@tauri-apps/api/core";
import { useStore, PortForwardingRule } from "../store/useStore";
import {
  Shuffle,
  Trash2,
  PlusCircle,
  ArrowRight,
  Power,
  PowerOff,
} from "lucide-react";
import { ask, message } from "@tauri-apps/plugin-dialog";

interface PortForwardingScreenProps {
  readonly onAddRule: () => void;
  readonly onEditRule: (rule: PortForwardingRule) => void;
}

export default function PortForwardingScreen({
  onAddRule,
  onEditRule,
}: PortForwardingScreenProps) {
  const {
    portForwardingRules,
    removePortForwardingRule,
    updatePortForwardingRule,
    hosts,
  } = useStore();

  const handleDelete = async (e: React.MouseEvent, rule: PortForwardingRule) => {
    e.stopPropagation();
    
    const confirmed = await ask(`Delete forwarding rule "${rule.label}"?`, {
      title: "Confirm Deletion",
      kind: "warning",
    });
    
    if (!confirmed) return;

    try {
      await invoke("delete_port_forwarding_rule", { id: rule.id });
      removePortForwardingRule(rule.id);
    } catch (err) {
      await message("Delete failed: " + err, { title: "Error", kind: "error" });
      console.error("Delete failed:", err);
    }
  };

  const toggleRule = async (rule: PortForwardingRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    try {
      await invoke("save_port_forwarding_rule", { rule: updated });
      updatePortForwardingRule(updated);
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const getHostLabel = (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    return host ? host.label : "Unknown Host";
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-8 space-y-10"
      id="main-scroll-area"
    >
      <section data-purpose="port-forwarding-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Port Forwarding (Tunnels)
          </h2>
          <span className="text-xs text-slate-500">
            {portForwardingRules.length} rules defined
          </span>
        </div>

        <div className="flex flex-col space-y-3">
          {portForwardingRules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center bg-card-slate border border-slate-800/80 rounded-xl px-6 py-4 hover:border-slate-700 transition-all group ${rule.enabled ? "" : "opacity-60"}`}
            >
              <div
                className={`p-3 rounded-lg mr-5 transition-colors ${rule.enabled ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-slate-800 text-slate-500 border border-slate-700"}`}
              >
                <Shuffle className="w-5 h-5" />
              </div>

              <div className="flex-1 grid grid-cols-4 items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white mb-0.5">
                    {rule.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                    Label
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-sm text-slate-300 font-semibold mb-0.5">
                    {getHostLabel(rule.hostId)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                    SSH Host
                  </span>
                </div>

                <div className="flex flex-col col-span-2">
                  <div className="flex items-center space-x-2 text-slate-200 font-mono text-sm mb-0.5">
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800/50">
                      {rule.type === "local"
                        ? `L:${rule.localPort}`
                        : `R:${rule.localPort}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800/50">
                      {rule.remoteHost}:{rule.remotePort}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                    {rule.type === "local"
                      ? "Local Forwarding"
                      : "Remote Forwarding (Reverse)"}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 ml-4">
                <button
                  onClick={() => toggleRule(rule)}
                  className={`p-2 rounded-lg border transition-all ${rule.enabled ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"}`}
                  title={
                    rule.enabled
                      ? "Enabled (Will auto-start on connect)"
                      : "Disabled"
                  }
                >
                  {rule.enabled ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onEditRule(rule)}
                  className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-all opacity-0 group-hover:opacity-100"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => handleDelete(e, rule)}
                  className="p-2 bg-slate-800/50 border border-slate-800 rounded-lg text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center group-hover:bg-red-500/5 relative z-10"
                  title="Delete Rule"
                >
                  <Trash2 className="w-4 h-4 pointer-events-none" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={onAddRule}
            className="flex items-center justify-center p-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/10 hover:border-slate-700 transition-all space-x-3 group"
          >
            <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Add New Forwarding Rule</span>
          </button>
        </div>
      </section>
    </div>
  );
}
