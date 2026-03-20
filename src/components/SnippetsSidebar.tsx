import { useState, useEffect, useRef } from "react";
import { Search, Send, Terminal as TerminalIcon, X, Code, Plus } from "lucide-react";
import { useStore } from "../store/useStore";
import { invoke } from "@tauri-apps/api/core";

export default function SnippetsSidebar() {
  const { snippets, snippetsOpen, setSnippetsOpen, activePaneId, history } = useStore();
  const [snippetSearch, setSnippetSearch] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        snippetsOpen && 
        sidebarRef.current && 
        !sidebarRef.current.contains(event.target as Node)
      ) {
        // Don't close if we're clicking the toggle button in the title bar
        const target = event.target as HTMLElement;
        if (target.closest('button[title="Toggle snippets sidebar"]')) {
          return;
        }
        setSnippetsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [snippetsOpen, setSnippetsOpen]);

  const insertSnippet = (content: string) => {
    if (!activePaneId) return;
    
    // We need to find the session to get the backend sessionId
    const state = useStore.getState();
    const session = state.sessions.find(s => s.tabId === activePaneId);
    
    if (session?.sessionId) {
      const data = content.endsWith("\n") || content.endsWith("\r")
        ? content
        : content + "\n";
      
      invoke("send_input", {
        sessionId: session.sessionId,
        data
      }).catch(console.error);
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={`fixed top-10 right-0 bottom-0 z-40 bg-[#1e2130]/95 backdrop-blur-xl border-l border-white/10 flex flex-col transition-all duration-300 ease-in-out shadow-2xl overflow-hidden ${
        snippetsOpen ? "w-80" : "w-0 opacity-0 pointer-events-none"
      }`}
    >
      <div className="p-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-3 text-white">
          <h3 className="font-bold flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-blue-400" />
            Quick Snippets
          </h3>
          <button 
            onClick={() => setSnippetsOpen(false)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search snippets..."
            value={snippetSearch}
            onChange={(e) => setSnippetSearch(e.target.value)}
            className="w-full bg-[#0f1117] border border-white/5 focus:border-blue-500/50 rounded-lg py-1.5 pl-9 pr-3 text-xs text-white outline-none transition-all placeholder:text-gray-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {snippets
          .filter(s => 
            s.name.toLowerCase().includes(snippetSearch.toLowerCase()) || 
            s.tags?.toLowerCase().includes(snippetSearch.toLowerCase())
          )
          .map(snippet => (
            <button
              key={snippet.id}
              onClick={() => insertSnippet(snippet.content)}
              className="w-full text-left p-3 rounded-xl hover:bg-white/5 group transition-colors flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate group-hover:text-blue-400 transition-colors">
                  {snippet.name}
                </div>
                <div className="text-gray-500 text-[10px] font-mono mt-1 opacity-80 group-hover:opacity-100 line-clamp-2 break-all">
                  {snippet.content}
                </div>
              </div>
              <Send className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 mt-1 transition-colors" />
            </button>
          ))
        }
        {snippets.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-xs">
            No snippets saved yet.
          </div>
        )}

        {/* Recent History Section */}
        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/5 pb-10">
            <div className="px-3 mb-3 flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              <Code className="w-3 h-3" />
              Recent History
            </div>
            <div className="space-y-1">
              {history.map((cmd, idx) => (
                <button
                  key={`history-${idx}`}
                  onClick={() => insertSnippet(cmd)}
                  className="w-full text-left p-2.5 px-3 rounded-lg hover:bg-white/5 group transition-colors flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0 font-mono text-[11px] text-blue-300 opacity-70 group-hover:opacity-100 truncate">
                    {cmd}
                  </div>
                  <Plus className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
