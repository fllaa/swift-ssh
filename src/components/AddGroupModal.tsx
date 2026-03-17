import { useState } from "react";
import { X, FolderPlus, Folder, Cloud, Database, Server, Code } from "lucide-react";
import { useStore, Group } from "../store/useStore";
import { v4 as uuidv4 } from "uuid";

interface AddGroupModalProps {
  readonly group?: Group;
  readonly onClose: () => void;
}

export default function AddGroupModal({ group, onClose }: AddGroupModalProps) {
  const { addGroup, updateGroup, activeVaultId } = useStore();
  const isEdit = !!group;

  const [name, setName] = useState(group?.name ?? "");
  const [selectedIcon, setSelectedIcon] = useState(group?.icon ?? "folder");
  const [selectedColor, setSelectedColor] = useState(group?.color ?? "bg-blue-500");

  const icons = [
    { id: "folder", icon: Folder, label: "Folder" },
    { id: "cloud", icon: Cloud, label: "Cloud" },
    { id: "database", icon: Database, label: "DB" },
    { id: "server", icon: Server, label: "Server" },
    { id: "code", icon: Code, label: "Code" },
  ];

  const colors = [
    { id: "blue", class: "bg-blue-500", ring: "ring-blue-500" },
    { id: "emerald", class: "bg-emerald-500", ring: "ring-emerald-500" },
    { id: "purple", class: "bg-purple-500", ring: "ring-purple-500" },
    { id: "amber", class: "bg-amber-500", ring: "ring-amber-500" },
    { id: "rose", class: "bg-rose-500", ring: "ring-rose-500" },
    { id: "slate", class: "bg-slate-500", ring: "ring-slate-500" },
  ];

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (isEdit && group) {
      updateGroup({
        ...group,
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });
    } else {
      const newGroup: Group = {
        id: uuidv4(),
        name: name.trim(),
        vaultId: activeVaultId || "v1",
        icon: selectedIcon,
        color: selectedColor,
      };
      addGroup(newGroup);
    }
    
    onClose();
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
            <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FolderPlus className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-none">{isEdit ? "Edit Group" : "Create New Group"}</h2>
              <p className="text-slate-400 text-sm mt-1">{isEdit ? "Update your group details" : "Organize your hosts into logical collections"}</p>
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
          {/* Group Name Input */}
          <div>
            <label htmlFor="group-name" className="block text-sm font-semibold text-slate-300 mb-1.5">Group Name</label>
            <input 
              id="group-name"
              autoFocus
              className="w-full bg-space-dark border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 px-4 shadow-inner outline-none transition-all" 
              placeholder="e.g. Production, Databases" 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>

          {/* Icon Selection */}
          <div>
            <span id="group-icon-label" className="block text-sm font-semibold text-slate-300 mb-1.5">Group Icon</span>
            <div className="flex flex-wrap gap-3" aria-labelledby="group-icon-label">
              {icons.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button 
                    key={item.id}
                    onClick={() => setSelectedIcon(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      isSelected 
                        ? "bg-blue-500/20 border-blue-500 text-white" 
                        : "bg-space-dark border-slate-800 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <span id="group-color-label" className="block text-sm font-semibold text-slate-300 mb-1.5">Group Color</span>
            <div className="flex flex-wrap gap-4 items-center" aria-labelledby="group-color-label">
              {colors.map((color) => {
                const isSelected = selectedColor === color.class;
                return (
                  <button 
                    key={color.id}
                    onClick={() => setSelectedColor(color.class)}
                    className={`size-8 rounded-full ${color.class} transition-transform hover:scale-110 ${
                      isSelected 
                        ? `border-4 border-card-slate ring-2 ${color.ring}`
                        : ""
                    }`}
                    aria-label={color.id}
                  ></button>
                );
              })}
            </div>
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
            disabled={!name.trim()}
            className="px-8 py-2.5 rounded-xl bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isEdit ? "Update Group" : "Create Group"}
          </button>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-[-1]">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}
