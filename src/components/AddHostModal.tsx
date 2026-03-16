import { useState } from "react";
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
  Terminal,
  Monitor,
  Cloud,
  Box,
  Server,
  Plug,
} from "lucide-react";

interface AddHostModalProps {
  host: HostProfile | null;
  onClose: () => void;
}

export default function AddHostModal({ host, onClose }: AddHostModalProps) {
  const { addHost, updateHost, keys, groups } = useStore();
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
  
  const [tags, setTags] = useState("");
  const [osIcon, setOsIcon] = useState("ubuntu");
  const [showAdvanced, setShowAdvanced] = useState(true);

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
      alert(`Save failed: ${err}`);
    }
  };

  const isFormValid = hostname.trim() !== "" && username.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#0B1021]/90 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] bg-[#1C2333] border border-slate-800 shadow-2xl rounded-xl overflow-hidden flex flex-col text-slate-100">
        
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Label</label>
              <input 
                className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                placeholder="e.g. Production Web Server" 
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Address / IP</label>
              <input 
                className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                placeholder="192.168.1.1 or example.com" 
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Port</label>
                <input 
                  className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                  type="number" 
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Group</label>
                <select 
                  className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all appearance-none"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">None</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Authentication</h3>
              <div className="flex bg-[#0B1021] p-1 rounded-lg border border-slate-800">
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
                  <User className="absolute left-3 top-[14px] text-slate-500 w-5 h-5" />
                  <input 
                    className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white pl-10 pr-4 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all" 
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
                    <Lock className="absolute left-3 top-[14px] text-slate-500 w-5 h-5" />
                    <input 
                      className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white pl-10 pr-4 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all" 
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
                    <Lock className="absolute left-3 top-[14px] text-slate-500 w-5 h-5 pointer-events-none" />
                    <select 
                      className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white pl-10 pr-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all appearance-none"
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
              <div className="mt-4 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tags</label>
                  <input 
                    className="w-full bg-[#0B1021] border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 outline-none transition-all" 
                    placeholder="frontend, nginx, production..." 
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Server OS Icon</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: "ubuntu", label: "Ubuntu", icon: Terminal },
                      { id: "windows", label: "Windows", icon: Monitor },
                      { id: "aws", label: "AWS", icon: Cloud },
                      { id: "docker", label: "Docker", icon: Box },
                      { id: "centos", label: "CentOS", icon: Server },
                    ].map((os) => {
                      const Icon = os.icon;
                      const isSelected = osIcon === os.id;
                      return (
                        <button 
                          key={os.id}
                          onClick={() => setOsIcon(os.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? "bg-blue-500/20 border-blue-500 text-white"
                              : "bg-[#0B1021] border-slate-800 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-bold">{os.label}</span>
                        </button>
                      );
                    })}
                  </div>
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
