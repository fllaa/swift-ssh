import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { useStore, HostProfile } from "../store/useStore";
import {
  X,
  PlusSquare,
  User,
  Lock,
  Settings,
  ChevronDown,
  Plug,
  Search,
  Check,
  ChevronsUpDown,
  Shield,
} from "lucide-react";
import { message } from "@tauri-apps/plugin-dialog";

interface AddHostModalProps {
  host: HostProfile | null;
  onClose: () => void;
}

export default function AddHostModal({ host, onClose }: AddHostModalProps) {
  const { addHost, updateHost, keys, groups, hosts: allHosts } = useStore();
  const isEdit = !!host;

  const [label, setLabel] = useState(host?.label ?? "");
  const [hostname, setHostname] = useState(host?.hostname ?? "");
  const [port, setPort] = useState(host?.port ?? 22);
  const [groupId, setGroupId] = useState(host?.groupId ?? groups[0]?.id ?? "");
  const [username, setUsername] = useState(host?.username ?? "");
  const [authMethod, setAuthMethod] = useState<"password" | "key">(
    host?.authMethod ?? "password"
  );
  const [password, setPassword] = useState(host?.password ?? "");
  const [keyId, setKeyId] = useState(host?.keyId ?? "");
  
  const [tags, setTags] = useState(host?.tags ?? "");
  const [jumpHostId, setJumpHostId] = useState(host?.jumpHostId ?? "");
  const [agentForwarding, setAgentForwarding] = useState(host?.agentForwarding ?? false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedGroup = groups.find(g => g.id === groupId);
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const buildProfile = (): HostProfile => ({
    id: host?.id ?? uuidv4(),
    label: label || `${username}@${hostname}`,
    hostname,
    port,
    username,
    authMethod,
    groupId,
    tags,
    jumpHostId,
    agentForwarding,
    ...(authMethod === "password" ? { password } : { keyId }),
  });

  const handleTest = async () => {
    if (!hostname || !username) return;
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await invoke<string>("test_connection", {
        profile: buildProfile(),
      });
      setTestResult({ ok: true, msg });
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!hostname || !username) return;
    const profile = buildProfile();

    try {
      await invoke("save_host", { profile });
      if (isEdit) {
        updateHost(profile);
      } else {
        addHost(profile);
      }
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      await message(`Save failed: ${err}`, { title: "Error", kind: "error" });
    }
  };

  const isFormValid = hostname.trim() !== "" && username.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-space-dark/90 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] bg-card-slate border border-slate-800 shadow-2xl rounded-xl overflow-hidden flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#161d2b]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <PlusSquare className="text-blue-500 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-none">
                {isEdit ? "Edit Host" : "Add New Host"}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {isEdit ? "Update your remote server details" : "Configure a new remote server connection"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* General Info */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-6">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Label</label>
              <input 
                className="w-full bg-space-dark border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                placeholder="e.g. Production Web Server" 
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            
            <div className="md:col-span-4">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Address / IP</label>
              <input 
                className="w-full bg-space-dark border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                placeholder="192.168.1.1 or example.com" 
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Port</label>
              <input 
                className="w-full bg-space-dark border border-slate-800 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                type="number" 
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Group (Type)</label>
              <div className="relative" ref={groupDropdownRef}>
                <div 
                  className="w-full bg-space-dark border border-slate-800 rounded-xl text-white h-12 px-4 flex items-center justify-between cursor-pointer focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all"
                  onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                >
                  <span className={selectedGroup ? "text-white" : "text-slate-500"}>
                    {selectedGroup ? selectedGroup.name : "None / Uncategorized"}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-slate-500" />
                </div>

                {showGroupDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card-slate border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in duration-200">
                    <div className="p-2 border-b border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          autoFocus
                          className="w-full bg-space-dark border border-slate-800 rounded-lg text-sm text-white pl-9 pr-4 py-2 outline-none focus:border-blue-500"
                          placeholder="Search groups..."
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      <button 
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${groupId === "" ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        onClick={() => {
                          setGroupId("");
                          setShowGroupDropdown(false);
                          setGroupSearch("");
                        }}
                      >
                        <span>None</span>
                        {!groupId && <Check className="w-4 h-4" />}
                      </button>
                      {filteredGroups.map(g => (
                        <button 
                          key={g.id}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${groupId === g.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                          onClick={() => {
                            setGroupId(g.id);
                            setShowGroupDropdown(false);
                            setGroupSearch("");
                          }}
                        >
                          <span>{g.name}</span>
                          {groupId === g.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {filteredGroups.length === 0 && groupSearch && (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">
                          No groups found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Authentication</h3>
              <div className="flex bg-space-dark p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setAuthMethod("password")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${authMethod === 'password' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Password
                </button>
                <button 
                  onClick={() => setAuthMethod("key")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${authMethod === 'key' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  SSH Key
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
                  <input 
                    className="w-full bg-space-dark border border-slate-800 rounded-xl text-white pl-10 pr-4 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all" 
                    placeholder="root" 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {authMethod === "password" ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
                    <input 
                      className="w-full bg-space-dark border border-slate-800 rounded-xl text-white pl-10 pr-4 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all" 
                      placeholder="••••••••" 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">SSH Key</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-500 w-5 h-5 pointer-events-none" />
                    <select 
                      className="w-full bg-space-dark border border-slate-800 rounded-xl text-white pl-10 pr-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all appearance-none"
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                    >
                      <option value="">Select a key...</option>
                      {keys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.fingerprint})
                        </option>
                      ))}
                    </select>
                  </div>
                  {keys.length === 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      No keys saved. Add one in the Keys tab first.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test connection results banner */}
          {testResult && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-sm border ${
              testResult.ok 
                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {testResult.ok ? "Connection successful!" : testResult.msg}
            </div>
          )}

          {/* Advanced */}
          <div className="pt-4 border-t border-slate-800">
            <button 
              className="flex items-center justify-between w-full group outline-none"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-2">
                <Settings className="text-slate-500 w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Advanced Settings</h3>
              </div>
              <ChevronDown className={`text-slate-500 w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            
            {showAdvanced && (
              <div className="mt-4">
                 <div className="mt-4 mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-500" />
                    Jump Host
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-space-dark border border-slate-800 rounded-xl text-white px-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all appearance-none"
                      value={jumpHostId}
                      onChange={(e) => setJumpHostId(e.target.value)}
                    >
                      <option value="">None (Direct Connection)</option>
                      {allHosts
                        .filter((h) => h.id !== host?.id)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.label} ({h.username}@{h.hostname})
                          </option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Connect through another host as a proxy / bastion host.
                  </p>
                </div>

                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tags</label>
                <input
                  className="w-full bg-space-dark border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all"
                  placeholder="frontend, nginx, production..."
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />

                <div className="mt-4 flex items-center justify-between p-4 bg-space-dark border border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">SSH Agent Forwarding</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Allow remote server to use your local SSH agent</p>
                  </div>
                  <button
                    onClick={() => setAgentForwarding(!agentForwarding)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${agentForwarding ? 'bg-blue-500' : 'bg-slate-700'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${agentForwarding ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#161d2b] flex items-center gap-3 justify-between">
          <button 
            className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleTest}
            disabled={!isFormValid || testing}
          >
            <Plug className="w-5 h-5" />
            {testing ? "Testing..." : "Test Connection"}
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              className="px-6 py-2.5 rounded-xl text-slate-400 font-bold hover:text-white hover:bg-slate-800 transition-all"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="px-8 py-2.5 rounded-xl bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              onClick={handleSave}
              disabled={!isFormValid}
            >
              {isEdit ? "Update Host" : "Add Host"}
            </button>
          </div>
        </div>

      </div>
      
      <style>{`
        /* Note: Add this to your global css if not already present */
        .overflow-y-auto::-webkit-scrollbar {
            width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
            background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }
      `}</style>
    </div>
  );
}
