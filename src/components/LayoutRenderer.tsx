import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useStore, LayoutNode, removeFromLayout } from "../store/useStore";
import TerminalTab from "./TerminalTab";
import SftpTab from "./SftpTab";

interface LayoutRendererProps {
  tabGroupId: string;
  node: LayoutNode;
  onEditHost: (host: any) => void;
}

export default function LayoutRenderer({
  tabGroupId,
  node,
  onEditHost,
}: {
  readonly tabGroupId: string;
  readonly node: LayoutNode;
  readonly onEditHost: (host: any) => void;
}) {
  const { tabs, sessions, removeTab, updateTabLayout, removeSession, isDraggingTab, activePaneId, setActivePaneId } =
    useStore();
  const [dragOverSide, setDragOverSide] = useState<
    "top" | "bottom" | "left" | "right" | null
  >(null);

  if (node.type === "pane") {
    const session = sessions.find((s) => s.tabId === node.sessionId);
    if (!session)
      return <div className="p-4 text-slate-500">Session not found</div>;

    const tabGroup = tabs.find((t) => t.id === tabGroupId);
    const countSessions = (n: any): number => {
      if (!n) return 1;
      if (n.type === "pane") return 1;
      return countSessions(n.first) + countSessions(n.second);
    };
    const sessionCount = tabGroup ? countSessions(tabGroup.layout) : 1;

    return (
      <div
        className={`w-full h-full relative group/pane overflow-hidden transition-colors duration-200 ${
          sessionCount > 1 
            ? activePaneId === node.sessionId
              ? "border border-blue-500 rounded-xl overflow-hidden shadow-sm z-10"
              : "border border-[#1e2130] rounded-xl overflow-hidden"
            : ""
        }`}
        onPointerDownCapture={() => setActivePaneId(node.sessionId)}
        onFocusCapture={() => setActivePaneId(node.sessionId)}
        onDragEnter={(e) => {
          e.preventDefault();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();

          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const w = rect.width;
          const h = rect.height;

          const midX = w / 2;
          const midY = h / 2;
          const dx = x - midX;
          const dy = y - midY;

          let side: "top" | "bottom" | "left" | "right" | null = null;

          // Use triangle detection
          if (Math.abs(dx / w) > Math.abs(dy / h)) {
            side = dx < 0 ? "left" : "right";
          } else {
            side = dy < 0 ? "top" : "bottom";
          }

          setDragOverSide(side);
        }}
        onDragLeave={() => setDragOverSide(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverSide(null);
          const state = useStore.getState();
          state.setIsDraggingTab(false);

          const draggedTabId = e.dataTransfer.getData("tabId");
          if (!draggedTabId) return;

          if (draggedTabId === tabGroupId) return;

          // Calculate split direction based on drop position
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const w = rect.width;
          const h = rect.height;

          const midX = w / 2;
          const midY = h / 2;
          const dx = x - midX;
          const dy = y - midY;

          let direction: "horizontal" | "vertical";
          let position: "first" | "second";

          if (Math.abs(dx / w) > Math.abs(dy / h)) {
            direction = "horizontal";
            position = dx < 0 ? "second" : "first";
          } else {
            direction = "vertical";
            position = dy < 0 ? "second" : "first";
          }

          const draggedTab = state.tabs.find((t) => t.id === draggedTabId);
          if (!draggedTab) return;

          // Move all sessions from dragged tab into this tab group
          // For simplicity, we assume the dragged tab has a single pane
          // A more robust implementation would recursively collect all sessions
          const getSessionIds = (n: LayoutNode): string[] => {
            if (n.type === "pane") return [n.sessionId];
            return [...getSessionIds(n.first), ...getSessionIds(n.second)];
          };
          const draggedSessionIds = getSessionIds(draggedTab.layout);

          // Current node layout (the pane being dropped onto)
          const currentPaneNode: LayoutNode = {
            type: "pane",
            sessionId: node.sessionId,
          };
          // For now, we only take the first session from the dragged tab to simplify the split
          const draggedPaneNode: LayoutNode = {
            type: "pane",
            sessionId: draggedSessionIds[0],
          };

          const newLayout: LayoutNode = {
            type: "split",
            direction,
            first: position === "first" ? currentPaneNode : draggedPaneNode,
            second: position === "first" ? draggedPaneNode : currentPaneNode,
            splitRatio: 50,
          };

          // Update this tab's layout
          // We need a way to replace JUST this leaf node in the tree.
          // This requires a more complex layout update helper.
          // But since LayoutRenderer is recursive, we can pass down an 'onUpdate' callback.

          // For now, let's just implement a global helper to replace a leaf in a tree.
          const replaceNode = (
            root: LayoutNode,
            targetSessionId: string,
            replacement: LayoutNode,
          ): LayoutNode => {
            if (root.type === "pane") {
              return root.sessionId === targetSessionId ? replacement : root;
            }
            return {
              ...root,
              first: replaceNode(root.first, targetSessionId, replacement),
              second: replaceNode(root.second, targetSessionId, replacement),
            };
          };

          const fullRoot = state.tabs.find((t) => t.id === tabGroupId)?.layout;
          if (fullRoot) {
            state.updateTabLayout(
              tabGroupId,
              replaceNode(fullRoot, node.sessionId, newLayout),
            );
            state.removeTabOnly(draggedTabId);
          }
        }}
      >
        <div
          className={`w-full h-full relative ${isDraggingTab ? "pointer-events-none" : ""}`}
        >
          {/* Floating Session Name Pill */}
          {sessionCount > 1 && (
              <div className="absolute top-3 left-3 z-30 px-2.5 py-1 bg-[#1e2130]/60 backdrop-blur-md border border-white/5 rounded-lg shadow-2xl pointer-events-none transition-all duration-300 group-hover/pane:opacity-100 group-hover/pane:translate-y-0 opacity-40 -translate-y-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${session.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"}`}
                    />
                    <span className="text-[10px] font-black text-white/80 tracking-widest">
                      {session.label}
                    </span>
                  </div>
                </div>
          )}

          {session.type === "sftp" ? (
            <SftpTab tabId={session.tabId} hostId={session.hostId} />
          ) : (
            <TerminalTab
              tabId={session.tabId}
              hostId={session.hostId}
              onEditHost={onEditHost}
              onClose={() => {
                // Terminal disconnection is handled by TerminalTab's handleClose
                // via destroyTerminalInstance - we only handle layout cleanup here
                const state = useStore.getState();
                const fullRoot = state.tabs.find(
                  (t) => t.id === tabGroupId,
                )?.layout;
                if (fullRoot) {
                  const nextLayout = removeFromLayout(fullRoot, session.tabId);
                  if (nextLayout) {
                    updateTabLayout(tabGroupId, nextLayout);
                    removeSession(session.tabId);
                  } else {
                    removeTab(tabGroupId);
                  }
                }
              }}
            />
          )}
        </div>

        {/* Visual feedback for drop zones */}
        <div className="absolute inset-0 pointer-events-none z-50">
          {dragOverSide === "top" && (
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-blue-500/20 border-b-2 border-blue-500 animate-pulse" />
          )}
          {dragOverSide === "bottom" && (
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-blue-500/20 border-t-2 border-blue-500 animate-pulse" />
          )}
          {dragOverSide === "left" && (
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-blue-500/20 border-r-2 border-blue-500 animate-pulse" />
          )}
          {dragOverSide === "right" && (
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-blue-500/20 border-l-2 border-blue-500 animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  return (
    <PanelGroup direction={node.direction}>
      <Panel defaultSize={node.splitRatio}>
        <LayoutRenderer
          tabGroupId={tabGroupId}
          node={node.first}
          onEditHost={onEditHost}
        />
      </Panel>
      <PanelResizeHandle className="w-1.5 h-1.5 bg-slate-800 hover:bg-blue-500 transition-colors" />
      <Panel defaultSize={100 - node.splitRatio}>
        <LayoutRenderer
          tabGroupId={tabGroupId}
          node={node.second}
          onEditHost={onEditHost}
        />
      </Panel>
    </PanelGroup>
  );
}
