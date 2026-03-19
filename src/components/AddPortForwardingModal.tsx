import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, PortForwardingRule } from "../store/useStore";
import { Info, Search, Check, ChevronsUpDown, X, Shuffle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { message } from "@tauri-apps/plugin-dialog";

interface AddPortForwardingModalProps {
  readonly rule?: PortForwardingRule;
  readonly onClose: () => void;
}

export default function AddPortForwardingModal({ rule, onClose }: AddPortForwardingModalProps) {
  const { hosts, addPortForwardingRule, updatePortForwardingRule } = useStore();
  const [label, setLabel] = useState("");
  const [hostId, setHostId] = useState("");
  const [type, setType] = useState<"local" | "remote">("local");
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState("127.0.0.1");
  const [remotePort, setRemotePort] = useState(80);

  const [hostSearch, setHostSearch] = useState("");
  const [showHostDropdown, setShowHostDropdown] = useState(false);
  const hostDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hostDropdownRef.current && !hostDropdownRef.current.contains(event.target as Node)) {
        setShowHostDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (rule) {
      setLabel(rule.label);
      setHostId(rule.hostId);
      setType(rule.type);
      setLocalPort(rule.localPort);
      setRemoteHost(rule.remoteHost);
      setRemotePort(rule.remotePort);
    } else if (hosts.length > 0) {
      setHostId(hosts[0].id);
    }
  }, [rule, hosts]);

  const selectedHost = hosts.find((h) => h.id === hostId);
  const filteredHosts = hosts.filter((h) =>
    h.label.toLowerCase().includes(hostSearch.toLowerCase()) ||
    h.hostname.toLowerCase().includes(hostSearch.toLowerCase())
  );

  const handleSave = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!hostId) {
      message("Please select a host.", { title: "Validation Error", kind: "warning" });
      return;
    }

    const newRule: PortForwardingRule = {
      id: rule?.id || uuidv4(),
      label: label || `${type.toUpperCase()}:${localPort} -> ${remoteHost}:${remotePort}`,
      hostId,
      type,
      localPort,
      remoteHost,
      remotePort,
      enabled: rule ? rule.enabled : true,
    };

    invoke("save_port_forwarding_rule", { rule: newRule })
      .then(() => {
        if (rule) {
          updatePortForwardingRule(newRule);
        } else {
          addPortForwardingRule(newRule);
        }
        onClose();
      })
      .catch(async (err) => {
        console.error(err);
        await message("Failed to save forwarding rule: " + err, { title: "Error", kind: "error" });
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1f2e] border border-slate-700/50 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <Shuffle className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {rule ? "Edit Tunnel" : "Add Port Forwarding Rule"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
          <form id="port-forward-form" onSubmit={handleSave} className="space-y-6">
            {/* Rule Label */}
            <div className="space-y-1.5">
              <label htmlFor="rule-label" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Rule Label
              </label>
              <input
                id="rule-label"
                type="text"
                placeholder="e.g., Local Dev Server"
                className="w-full bg-[#0f1117] border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            {/* Target Host Selection */}
            <div className="space-y-1.5" ref={hostDropdownRef}>
              <label htmlFor="ssh-host" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Select SSH Host
              </label>
              <div className="relative">
                <div 
                  id="ssh-host"
                  className="w-full bg-[#0f1117] border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
                  onClick={() => setShowHostDropdown(!showHostDropdown)}
                >
                  <span className={selectedHost ? "text-slate-200" : "text-slate-600"}>
                    {selectedHost ? `${selectedHost.label} (${selectedHost.hostname})` : "Select a host..."}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-slate-500" />
                </div>

                {showHostDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1f2e] border border-slate-700 shadow-2xl rounded-xl z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in duration-200">
                    <div className="p-2 border-b border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          autoFocus
                          className="w-full bg-[#0f1117] border border-slate-800 rounded-lg text-sm text-slate-200 pl-9 pr-4 py-2 outline-none focus:border-blue-500/50 transition-all"
                          placeholder="Search hosts..."
                          value={hostSearch}
                          onChange={(e) => setHostSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {filteredHosts.map((h) => (
                        <button 
                          key={h.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${hostId === h.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                          onClick={() => {
                            setHostId(h.id);
                            setShowHostDropdown(false);
                            setHostSearch("");
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold">{h.label}</span>
                            <span className="text-[10px] opacity-60 font-mono">{h.hostname}</span>
                          </div>
                          {hostId === h.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {filteredHosts.length === 0 && (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">
                          {hosts.length === 0 ? "No hosts available. Create one first." : "No hosts match your search"}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Forwarding Type & Local Port */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Type
                </label>
                <div className="flex bg-[#0f1117] border border-slate-800 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setType("local")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      type === "local"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Local (L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("remote")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      type === "remote"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Remote (R)
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="local-port" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Local Port
                </label>
                <input
                  id="local-port"
                  type="number"
                  placeholder="8080"
                  className="w-full bg-[#0f1117] border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-mono"
                  value={localPort}
                  onChange={(e) => setLocalPort(Number.parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
            </div>

            {/* Remote Destination */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label htmlFor="remote-host" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Remote Destination Host
                </label>
                <input
                  id="remote-host"
                  type="text"
                  placeholder="127.0.0.1"
                  className="w-full bg-[#0f1117] border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-mono"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="remote-port" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Port
                </label>
                <input
                  id="remote-port"
                  type="number"
                  placeholder="80"
                  className="w-full bg-[#0f1117] border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-mono"
                  value={remotePort}
                  onChange={(e) => setRemotePort(Number.parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-xs text-blue-400/80 leading-relaxed shrink-0">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <p>
                {type === "local" 
                  ? "Local Port Forwarding allows you to access remote network services (like a database or web server) through your local machine." 
                  : "Remote Port Forwarding (Reverse Tunnel) allows anyone on the remote server to access a service running on your local machine."}
              </p>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            form="port-forward-form"
            type="submit"
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {rule ? "Save Changes" : "Create Tunnel"}
          </button>
        </div>
      </div>
    </div>
  );
}
