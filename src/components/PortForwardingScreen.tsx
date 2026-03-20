import { invoke } from "@tauri-apps/api/core";
import { useStore, PortForwardingRule } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import {
  Shuffle,
  Trash2,
  ArrowRight,
  Power,
  PowerOff,
  Edit,
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
    forwardingSessions,
    setForwardingSession,
    removeForwardingSession,
    tabs,
  } = useStore();

  const handleDelete = async (
    e: React.MouseEvent,
    rule: PortForwardingRule,
  ) => {
    e.stopPropagation();
    const confirmed = await ask(`Delete forwarding rule "${rule.label}"?`, {
      title: "Confirm Deletion",
      kind: "warning",
    });
    if (!confirmed) return;

    try {
      await invoke("delete_port_forwarding_rule", { id: rule.id });
      removePortForwardingRule(rule.id);
      logActivity("port-forwarding", "delete", `Deleted forwarding rule "${rule.label}"`, { ruleId: rule.id });
    } catch (err) {
      await message("Delete failed: " + err, { title: "Error", kind: "error" });
    }
  };

  const toggleRule = async (rule: PortForwardingRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    try {
      await invoke("save_port_forwarding_rule", { rule: updated });
      updatePortForwardingRule(updated);
      logActivity("port-forwarding", updated.enabled ? "enable" : "disable", `${updated.enabled ? "Enabled" : "Disabled"} forwarding rule "${updated.label}"`, { ruleId: updated.id });

      // Live sync to any active sessions for this host
      const bgSid = forwardingSessions[rule.hostId];
      if (bgSid) {
        await invoke("sync_port_forwarding", { sessionId: bgSid }).catch(
          console.error
        );
      }

      for (const tab of tabs) {
        if (tab.hostId === rule.hostId && tab.sessionId && tab.connected) {
          await invoke("sync_port_forwarding", {
            sessionId: tab.sessionId,
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const handleStartForwarding = async (hostId: string) => {
    try {
      const sessionId = await invoke<string>("connect_host", {
        hostId,
        noShell: true,
      });
      setForwardingSession(hostId, sessionId);
    } catch (err) {
      await message("Failed to start forwarding: " + err, {
        title: "Error",
        kind: "error",
      });
    }
  };

  const handleStopForwarding = async (hostId: string) => {
    const sessionId = forwardingSessions[hostId];
    if (!sessionId) return;
    try {
      await invoke("disconnect_host", { sessionId });
      removeForwardingSession(hostId);
    } catch (err) {
      console.error("Failed to stop forwarding:", err);
    }
  };

  const groupedRules = portForwardingRules.reduce(
    (acc, rule) => {
      if (!acc[rule.hostId]) acc[rule.hostId] = [];
      acc[rule.hostId].push(rule);
      return acc;
    },
    {} as Record<string, PortForwardingRule[]>,
  );

  return (
    <div
      className="flex-1 overflow-y-auto p-8 space-y-10"
      id="main-scroll-area"
    >
      <section data-purpose="port-forwarding-section">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Port Forwarding
            </h2>
            <p className="text-slate-500 text-sm">
              Manage SSH tunnels and background port forwarding
            </p>
          </div>
        </div>

        {Object.entries(groupedRules).length === 0 ? (
          <div
            onClick={onAddRule}
            className="border border-dashed border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-4 opacity-70 min-h-75"
          >
            <Shuffle className="w-12 h-12 text-slate-600" />
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-300">
                No active tunnels
              </p>
              <p className="text-sm text-slate-500">
                Click to add your first port forwarding rule
              </p>
            </div>
          </div>
        ) : (
          <>
            {Object.entries(groupedRules).map(([hostId, rules]) => {
              const host = hosts.find((h) => h.id === hostId);
              const isForwarding = !!forwardingSessions[hostId];

              return (
                <div key={hostId} className="mb-10 last:mb-0">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                        <Power
                          className={`w-4 h-4 ${isForwarding ? "text-green-500" : "text-slate-600"}`}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight">
                          {host?.label || "Unknown Host"}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {host?.username}@{host?.hostname}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {isForwarding ? (
                        <button
                          onClick={() => handleStopForwarding(hostId)}
                          className="flex items-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          <span>Stop Tunnels</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartForwarding(hostId)}
                          className="flex items-center space-x-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>Start Tunnels</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center bg-card-slate border border-slate-800/80 rounded-xl px-5 py-3.5 hover:border-slate-700 transition-all group ${rule.enabled ? "" : "opacity-40 grayscale"}`}
                      >
                        <div className="flex-1 grid grid-cols-6 items-center gap-6">
                          <div className="col-span-2 flex flex-col">
                            <span className="text-sm font-semibold text-slate-200">
                              {rule.label}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              Rule Name
                            </span>
                          </div>

                          <div className="col-span-3 flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/50 font-mono text-xs">
                              <span
                                className={`${rule.type === "local" ? "text-blue-400" : "text-purple-400"} font-bold`}
                              >
                                {rule.type === "local" ? "LOCAL" : "REMOTE"}
                              </span>
                              <span className="text-slate-200">
                                {rule.localPort}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                              <span className="text-slate-400">
                                {rule.remoteHost}:{rule.remotePort}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2 items-center">
                            <button
                              onClick={() => toggleRule(rule)}
                              className={`p-1.5 rounded-md border transition-all ${rule.enabled ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-600"}`}
                              title={
                                rule.enabled
                                  ? "Rule is active"
                                  : "Rule is disabled"
                              }
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onEditRule(rule)}
                              className="p-1.5 text-slate-500 hover:text-white transition-colors"
                              title="Edit Rule"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, rule)}
                              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add Placeholder at the end of the list */}
            <div
              onClick={onAddRule}
              className="border border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60 min-h-32 mt-6"
            >
              <Shuffle className="w-8 h-8 text-slate-600" />
              <span className="text-sm font-medium text-slate-500">
                Add New Forwarding Rule
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
