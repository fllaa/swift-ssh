import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, SSHKey } from "../store/useStore";

export default function KeyManager() {
  const { keys, addKey, removeKey } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [privateKeyContent, setPrivateKeyContent] = useState("");

  const handleSave = async () => {
    if (!name || !privateKeyContent) return;
    try {
      const key = await invoke<SSHKey>("save_key", {
        name,
        privateKeyContent,
      });
      addKey(key);
      setName("");
      setPrivateKeyContent("");
      setShowAdd(false);
    } catch (err) {
      console.error("Save key failed:", err);
      alert(`Failed to save key: ${err}`);
    }
  };

  const handleDelete = async (key: SSHKey) => {
    if (!confirm(`Delete key "${key.name}"?`)) return;
    try {
      await invoke("delete_key", { keyId: key.id });
      removeKey(key.id);
    } catch (err) {
      console.error("Delete key failed:", err);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pem,.key,.pub,*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setPrivateKeyContent(text);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    };
    input.click();
  };

  return (
    <div className="p-2">
      {keys.map((key) => (
        <div
          key={key.id}
          className="group flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#282b3e] mb-1"
        >
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">
              {key.name}
            </div>
            <div className="text-xs text-gray-500 truncate font-mono">
              {key.fingerprint}
            </div>
          </div>
          <button
            onClick={() => handleDelete(key)}
            className="text-gray-400 hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Delete"
          >
            ✕
          </button>
        </div>
      ))}

      {keys.length === 0 && !showAdd && (
        <p className="text-gray-500 text-xs text-center py-4">
          No SSH keys saved
        </p>
      )}

      {showAdd ? (
        <div className="mt-2 p-3 bg-[#0f1117] rounded-md border border-[#2a2d3e]">
          <div className="mb-2">
            <label className="block text-xs text-gray-400 mb-1">
              Key Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-server-key"
              className="w-full bg-[#161822] border border-[#2a2d3e] rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Private Key</label>
              <button
                onClick={handleImportFile}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Import file
              </button>
            </div>
            <textarea
              value={privateKeyContent}
              onChange={(e) => setPrivateKeyContent(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              rows={4}
              className="w-full bg-[#161822] border border-[#2a2d3e] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-1.5 rounded text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name || !privateKeyContent}
              className="flex-1 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Save Key
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full mt-2 py-2 rounded-md border border-dashed border-[#3a3f55] text-gray-400 text-sm hover:border-blue-500 hover:text-blue-400 transition-colors"
        >
          + Add Key
        </button>
      )}
    </div>
  );
}
