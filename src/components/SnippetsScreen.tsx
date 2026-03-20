import React, { useState } from "react";
import { useStore, Snippet } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import { 
  Plus, 
  Terminal, 
  Trash2, 
  Edit2, 
  Copy, 
  Check, 
  Code
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import AddSnippetModal from "./AddSnippetModal";

const SnippetsScreen: React.FC = () => {
  const { snippets, removeSnippet, dashboardViewMode, history, addSnippet } = useStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSnippets = snippets;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("delete_snippet", { id });
      const snippet = snippets.find((s) => s.id === id);
      removeSnippet(id);
      logActivity("snippet", "delete", `Deleted snippet "${snippet?.name || id}"`, { snippetId: id });
    } catch (err) {
      console.error("Failed to delete snippet:", err);
    }
  };

  const handleEdit = (snippet: Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSnippet(snippet);
    setIsAddModalOpen(true);
  };

  const handleCopy = (content: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Code className="w-6 h-6 text-blue-400" />
              Snippet Library
            </h1>
            <p className="text-gray-400 text-sm mt-1">Manage your frequently used commands</p>
          </div>
          <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            {snippets.length} saved snippets
          </div>
        </div>

      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
        {snippets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-[#1e2130] rounded-2xl flex items-center justify-center mb-4 border border-[#2a2d3e]">
              <Terminal className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-gray-300 font-medium">No snippets found</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-50">
              Add your first command snippet to get started
            </p>
          </div>
        )}

        <div className={dashboardViewMode === "grid" 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "flex flex-col gap-2"
        }>
          {filteredSnippets.map((snippet) => (
            <div
              key={snippet.id}
              className="group relative bg-[#1e2130]/40 hover:bg-[#1e2130]/80 border border-[#2a2d3e] hover:border-blue-500/30 rounded-2xl p-4 transition-all duration-300 backdrop-blur-sm shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate group-hover:text-blue-400 transition-colors">
                    {snippet.name}
                  </h3>
                  {snippet.description && (
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{snippet.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleCopy(snippet.content, snippet.id, e)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === snippet.id ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleEdit(snippet, e)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Edit snippet"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(snippet.id, e)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors"
                    title="Delete snippet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-[#0f1117] rounded-xl p-3 font-mono text-xs text-blue-300 border border-white/5 overflow-hidden">
                <div className="line-clamp-2 break-all opacity-80 group-hover:opacity-100 transition-opacity">
                  {snippet.content}
                </div>
              </div>

              {snippet.tags && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {snippet.tags.split(",").map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium rounded-full"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Add Placeholder */}
          <div 
            onClick={() => {
              setEditingSnippet(undefined);
              setIsAddModalOpen(true);
            }}
            className="border border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-slate-800/30 cursor-pointer transition-all space-y-2 opacity-60 min-h-40"
          >
            <Plus className="w-8 h-8 text-slate-600" />
            <span className="text-sm font-medium text-slate-500">New Snippet</span>
          </div>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-blue-400" />
                  Command History
                </h2>
                <p className="text-gray-400 text-sm mt-1">Recently executed commands from your terminals</p>
              </div>
              <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                {history.length} items
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {history.map((cmd, idx) => (
                <div 
                  key={`history-${idx}`}
                  className="bg-[#1e2130]/30 border border-[#2a2d3e] rounded-xl p-3 flex items-center justify-between group hover:border-blue-500/30 transition-all"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="font-mono text-xs text-blue-300 truncate">
                      {cmd}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleCopy(cmd, `history-${idx}`, e)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === `history-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const newSnippet: Snippet = {
                          id: crypto.randomUUID(),
                          name: cmd.length > 20 ? cmd.substring(0, 20) + "..." : cmd,
                          content: cmd,
                        };
                        addSnippet(newSnippet);
                        invoke("save_snippet", { snippet: newSnippet }).catch(console.error);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/5 rounded-md transition-colors"
                      title="Save as snippet"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddSnippetModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          editingSnippet={editingSnippet}
        />
      )}
    </div>
  );
};

export default SnippetsScreen;
