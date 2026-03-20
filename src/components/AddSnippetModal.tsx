import React, { useState, useEffect } from "react";
import { X, Save, Command, AlignLeft, Tag } from "lucide-react";
import { useStore, Snippet } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import { invoke } from "@tauri-apps/api/core";

interface AddSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSnippet?: Snippet;
}

const AddSnippetModal: React.FC<AddSnippetModalProps> = ({
  isOpen,
  onClose,
  editingSnippet,
}) => {
  const { addSnippet, updateSnippet } = useStore();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingSnippet) {
      setName(editingSnippet.name);
      setContent(editingSnippet.content);
      setDescription(editingSnippet.description || "");
      setTags(editingSnippet.tags || "");
    } else {
      setName("");
      setContent("");
      setDescription("");
      setTags("");
    }
  }, [editingSnippet, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !content) return;

    setIsSaving(true);
    const snippetData: Snippet = {
      id: editingSnippet?.id || crypto.randomUUID(),
      name,
      content,
      description,
      tags,
    };

    try {
      await invoke("save_snippet", { snippet: snippetData });
      if (editingSnippet) {
        updateSnippet(snippetData);
        logActivity("snippet", "edit", `Updated snippet "${snippetData.name}"`, { snippetId: snippetData.id });
      } else {
        addSnippet(snippetData);
        logActivity("snippet", "add", `Created snippet "${snippetData.name}"`, { snippetId: snippetData.id });
      }
      onClose();
    } catch (err) {
      console.error("Failed to save snippet:", err);
    } finally {
      setIsSaving(false);
    }
  };

    let buttonText = "Save Snippet";
    if (isSaving) {
      buttonText = "Saving...";
    } else if (editingSnippet) {
      buttonText = "Update Snippet";
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#1e2130] w-full max-w-xl rounded-3xl border border-[#2a2d3e] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-[#2a2d3e]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {editingSnippet ? <AlignLeft className="w-5 h-5 text-blue-400" /> : <Command className="w-5 h-5 text-blue-400" />}
              {editingSnippet ? "Edit Snippet" : "Create New Snippet"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="snippet-name" className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Snippet Name
              </label>
              <input
                id="snippet-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Update system, Clear logs"
                className="w-full bg-[#0f1117] border border-[#2a2d3e] focus:border-blue-500 rounded-xl py-3 px-4 text-white outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="snippet-content" className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Content / Command
              </label>
              <div className="relative">
                <textarea
                  id="snippet-content"
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the command line(s) here..."
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] focus:border-blue-500 rounded-xl py-3 px-4 text-white font-mono text-sm outline-none transition-all placeholder:text-gray-600 custom-scrollbar resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="snippet-desc" className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                  Description (Optional)
                </label>
                <input
                  id="snippet-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does it do?"
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] focus:border-blue-500 rounded-xl py-3 px-4 text-white outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="snippet-tags" className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                  Tags (Comma separated)
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="snippet-tags"
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="docker, utils, logs"
                    className="w-full bg-[#0f1117] border border-[#2a2d3e] focus:border-blue-500 rounded-xl py-3 pl-10 pr-4 text-white outline-none transition-all placeholder:text-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-gray-400 font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <Save className="w-4 h-4" />
                {buttonText}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
};

export default AddSnippetModal;
