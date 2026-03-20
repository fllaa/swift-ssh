import { useState } from "react";
import { X, Key, Upload } from "lucide-react";
import { useStore, SSHKey } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

interface AddKeyModalProps {
  readonly onClose: () => void;
}

export default function AddKeyModal({ onClose }: AddKeyModalProps) {
  const { addKey } = useStore();
  const [name, setName] = useState("");
  const [privateKeyContent, setPrivateKeyContent] = useState("");

  const handleSave = async () => {
    if (!name.trim() || !privateKeyContent.trim()) return;
    try {
      const key = await invoke<SSHKey>("save_key", {
        name: name.trim(),
        privateKeyContent: privateKeyContent.trim(),
      });
      addKey(key);
      logActivity("key", "add", `Added SSH key "${key.name}"`, { keyId: key.id });
      onClose();
    } catch (err) {
      console.error("Save key failed:", err);
      await message(`Failed to save key: ${err}`, { title: "Error", kind: "error" });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-space-dark/90 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-card-slate border border-slate-800 shadow-2xl rounded-xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#161d2b]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Key className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-none">Add SSH Key</h2>
              <p className="text-slate-400 text-sm mt-1">Import a private key for authentication</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          {/* Key Name Input */}
          <div>
            <label htmlFor="key-name" className="block text-sm font-semibold text-slate-300 mb-1.5">Key Name</label>
            <input 
              id="key-name"
              autoFocus
              className="w-full bg-space-dark border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 shadow-inner outline-none transition-all" 
              placeholder="e.g. AWS Production Key" 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Key Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="key-content" className="block text-sm font-semibold text-slate-300">Private Key</label>
              <button
                onClick={handleImportFile}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Import File
              </button>
            </div>
            <textarea
              id="key-content"
              value={privateKeyContent}
              onChange={(e) => setPrivateKeyContent(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              rows={6}
              className="w-full bg-space-dark border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 font-mono shadow-inner outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-[#161d2b] flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-slate-400 font-bold hover:text-white hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim() || !privateKeyContent.trim()}
            className="px-8 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Save Key
          </button>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-[-1]">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-amber-400/10 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}
