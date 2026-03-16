import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { useStore, HostProfile } from "../store/useStore";

interface AddHostModalProps {
  host: HostProfile | null;
  onClose: () => void;
}

export default function AddHostModal({ host, onClose }: AddHostModalProps) {
  const { addHost, updateHost, keys } = useStore();
  const isEdit = !!host;

  const [label, setLabel] = useState(host?.label ?? "");
  const [hostname, setHostname] = useState(host?.hostname ?? "");
  const [port, setPort] = useState(host?.port ?? 22);
  const [username, setUsername] = useState(host?.username ?? "");
  const [authMethod, setAuthMethod] = useState<"password" | "key">(
    host?.authMethod ?? "password"
  );
  const [password, setPassword] = useState(host?.password ?? "");
  const [keyId, setKeyId] = useState(host?.keyId ?? "");
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1e2130] rounded-lg border border-[#2a2d3e] w-[440px] p-6">
        <h2 className="text-white font-semibold text-lg mb-4">
          {isEdit ? "Edit Host" : "Add Host"}
        </h2>

        <div className="space-y-3">
          <Field
            label="Label"
            value={label}
            onChange={setLabel}
            placeholder="My Server"
          />
          <Field
            label="Hostname / IP"
            value={hostname}
            onChange={setHostname}
            placeholder="192.168.1.100"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Field
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="root"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Auth method */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Auth Method
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAuthMethod("password")}
                className={`flex-1 py-2 rounded text-sm ${
                  authMethod === "password"
                    ? "bg-blue-600 text-white"
                    : "bg-[#0f1117] text-gray-400 border border-[#2a2d3e]"
                }`}
              >
                Password
              </button>
              <button
                onClick={() => setAuthMethod("key")}
                className={`flex-1 py-2 rounded text-sm ${
                  authMethod === "key"
                    ? "bg-blue-600 text-white"
                    : "bg-[#0f1117] text-gray-400 border border-[#2a2d3e]"
                }`}
              >
                SSH Key
              </button>
            </div>
          </div>

          {authMethod === "password" ? (
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                SSH Key
              </label>
              <select
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a key…</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.fingerprint})
                  </option>
                ))}
              </select>
              {keys.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  No keys saved. Add one in the Keys tab first.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Test result banner */}
        {testResult && (
          <div
            className={`mt-4 px-3 py-2 rounded text-sm ${
              testResult.ok
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            {testResult.ok ? "Connected successfully" : testResult.msg}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={handleTest}
            disabled={!hostname || !username || testing}
            className="px-4 py-2 rounded text-sm border border-[#3a3f55] text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hostname || !username}
              className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? "Save" : "Add Host"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
