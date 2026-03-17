import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, SSHKey } from "../store/useStore";
import { Key, Trash2, KeyRound, Copy, PlusCircle } from "lucide-react";

interface KeysScreenProps {
  readonly onAddKey: () => void;
}

export default function KeysScreen({ onAddKey }: KeysScreenProps) {
  const { keys, removeKey, dashboardViewMode } = useStore();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, key: SSHKey } | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    globalThis.addEventListener("click", handleClick);
    return () => globalThis.removeEventListener("click", handleClick);
  }, []);

  const handleDelete = async (key: SSHKey) => {
    if (!confirm(`Delete key "${key.name}"?`)) return;
    try {
      await invoke("delete_key", { keyId: key.id });
      removeKey(key.id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleCopyFingerprint = (key: SSHKey) => {
    navigator.clipboard.writeText(key.fingerprint).catch(console.error);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10" id="main-scroll-area">
      <section data-purpose="keys-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">SSH Keys</h2>
          <span className="text-xs text-slate-500">{keys.length} saved keys</span>
        </div>
        
        {dashboardViewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="keys-grid">
            {keys.map((key) => (
              <div 
                key={key.id} 
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    key
                  });
                }}
                className="bg-card-slate border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 transition-all relative group flex flex-col justify-between h-full"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-500">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{key.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 truncate" title={key.fingerprint}>
                      {key.fingerprint}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleCopyFingerprint(key)}
                    className="flex-1 py-1.5 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Fingerprint
                  </button>
                </div>
              </div>
            ))}

            {/* Add Placeholder */}
            <div 
              onClick={onAddKey}
              className="border border-dashed border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60 min-h-32"
            >
              <Key className="w-8 h-8 text-slate-600" />
              <span className="text-sm font-medium text-slate-500">Add SSH Key</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-1.5" id="keys-list">
            <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-2">
              <div className="col-span-5">Key Details</div>
              <div className="col-span-5">Fingerprint</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {keys.map((key) => (
              <div 
                key={key.id} 
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    key
                  });
                }}
                className="grid grid-cols-12 items-center bg-card-slate border border-slate-800/50 rounded-xl px-5 py-3 hover:bg-slate-800/60 hover:border-slate-700 transition-all group"
              >
                <div className="col-span-5 flex items-center space-x-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-200 truncate">{key.name}</span>
                </div>
                <div className="col-span-5">
                  <code className="text-[11px] px-2 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-800">
                    {key.fingerprint}
                  </code>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button 
                    onClick={() => handleCopyFingerprint(key)}
                    className="p-1.5 mr-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500 hover:text-amber-400 hover:border-amber-400/30 transition-all"
                    title="Copy Fingerprint"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add Placeholder in List Mode */}
            <div 
              onClick={onAddKey}
              className="border border-dashed border-slate-800 rounded-xl p-3 flex items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-x-2 group mt-2"
            >
              <PlusCircle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
              <span className="text-sm font-medium text-slate-500 group-hover:text-slate-400">Import New Key</span>
            </div>
          </div>
        )}
      </section>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-slate-800 border border-slate-700 shadow-xl rounded-md py-1 w-48 z-50 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              handleCopyFingerprint(contextMenu.key);
              setContextMenu(null);
            }}
          >
            <Copy className="w-4 h-4 text-slate-400" />
            Copy Fingerprint
          </button>
          <div className="my-1 border-t border-slate-700/50"></div>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 hover:text-red-300"
            onClick={() => {
              handleDelete(contextMenu.key);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-4 h-4 text-red-400/80" />
            Delete Key
          </button>
        </div>
      )}
    </div>
  );
}
