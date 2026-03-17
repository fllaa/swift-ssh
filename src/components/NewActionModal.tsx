import { useEffect } from "react";
import { X, Server, FolderPlus, Key, ChevronRight } from "lucide-react";

interface NewActionModalProps {
  readonly onClose: () => void;
  readonly onAddHost: () => void;
  readonly onAddGroup: () => void;
  readonly onAddKey: () => void;
}

export default function NewActionModal({
  onClose,
  onAddHost,
  onAddGroup,
  onAddKey,
}: NewActionModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", handleEsc);
    return () => globalThis.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const actions = [
    {
      id: "host",
      title: "Add New Host",
      description: "Connect to a new remote server via SSH",
      icon: Server,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      onClick: onAddHost,
      disabled: false,
    },
    {
      id: "group",
      title: "Add New Group",
      description: "Organize your hosts into a collection",
      icon: FolderPlus,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      onClick: onAddGroup,
      disabled: false,
    },
    {
      id: "key",
      title: "Add New Key",
      description: "Manage your SSH public and private keys",
      icon: Key,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      onClick: onAddKey,
      disabled: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-space-dark/80 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-card-slate border border-slate-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#161d2b]">
          <div>
            <h2 className="text-xl font-bold leading-none">New Quick Action</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">What would you like to create?</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Body */}
        <div className="p-4 space-y-2.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                  }
                }}
                disabled={action.disabled}
                className={`w-full group flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  action.disabled
                    ? "opacity-40 cursor-not-allowed border-transparent bg-slate-900/20"
                    : "bg-space-dark border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.98]"
                }`}
              >
                <div
                  className={`size-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${action.bgColor}`}
                >
                  <Icon className={`w-6 h-6 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold transition-colors ${action.disabled ? 'text-slate-500' : 'text-slate-100 group-hover:text-blue-400'}`}>
                      {action.title}
                    </h3>
                    {action.disabled && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md">Soon</span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${action.disabled ? 'text-slate-600' : 'text-slate-400'}`}>
                    {action.description}
                  </p>
                </div>
                {!action.disabled && (
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#161d2b] flex justify-center">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Press ESC to dismiss</p>
        </div>

        {/* Decorative Light */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full -mr-12 -mt-12 pointer-events-none"></div>
      </div>
    </div>
  );
}
