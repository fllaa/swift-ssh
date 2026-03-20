import { useState, useEffect, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";
import { logActivity } from "../lib/activityLog";
import {
  Key,
  Check,
  AlertCircle,
  Loader2,
  Settings,
  Monitor,
  Terminal,
  Lock,
  FileText,
} from "lucide-react";

type SettingsTab = "security" | "general" | "appearance" | "ssh-sftp";

export default function SettingsScreen() {
  const { settings, setSettings } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("security");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logRetentionLimit, setLogRetentionLimit] = useState(settings.logRetentionLimit);
  const [logRetentionDays, setLogRetentionDays] = useState<number | null>(settings.logRetentionDays);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    setLogRetentionLimit(settings.logRetentionLimit);
    setLogRetentionDays(settings.logRetentionDays);
  }, [settings]);

  const handleSaveLogSettings = async () => {
    const newSettings = { ...settings, logRetentionLimit, logRetentionDays };
    setSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleUpdatePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      await invoke("change_vault_password", {
        oldPassword,
        newPassword,
      });
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logActivity("vault", "change-password", "Master password changed");
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "security", label: "Security", icon: Lock },
    { id: "appearance", label: "Appearance", icon: Monitor },
    { id: "ssh-sftp", label: "SSH & SFTP", icon: Terminal },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#1a1f2e] text-slate-100 font-sans overflow-hidden">
      {/* Title Bar Placeholder */}
      <div className="h-10 shrink-0 border-b border-white/5 bg-[#202638] flex items-center pl-20 pr-4 z-20" data-tauri-drag-region>
        <div className="flex items-center gap-2">
           <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Settings</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/5 bg-[#171c2a] flex flex-col p-4 gap-1 z-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-space-dark/30 relative">
          <div className="max-w-2xl mx-auto p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === "security" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400 border border-blue-500/20">
                      <Key className="w-5 h-5" />
                    </div>
                    Master Password
                  </h2>
                  <p className="text-slate-400 mt-3 leading-relaxed max-w-lg">
                    Manage the encryption key for your local vault. Updating this password will automatically re-encrypt all stored hosts, keys, and snippets.
                  </p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <label htmlFor="current-password" className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                      placeholder="Enter current password"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 pt-2">
                    <div className="space-y-2">
                      <label htmlFor="new-password" className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        New Password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                        placeholder="Min. 8 characters"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                        placeholder="Repeat new password"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 text-sm text-red-400 bg-red-400/5 p-4 rounded-xl border border-red-400/10 animate-in zoom-in-95 duration-200">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-3 text-sm text-green-400 bg-green-400/5 p-4 rounded-xl border border-green-400/10 animate-in zoom-in-95 duration-200">
                      <Check className="w-5 h-5 shrink-0" />
                      Security credentials updated successfully.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 mt-6 shadow-xl shadow-blue-600/20 active:scale-[0.98] ${
                      loading ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Update Credentials"
                    )}
                  </button>
                </form>

                <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-6 max-w-lg">
                  <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Vault Security Notice
                  </h3>
                  <p className="text-xs text-slate-400 mt-3 leading-loose">
                    SwiftSSH utilizes AES-256-GCM encryption with Argon2id key derivation. Your master password is the primary root for all derived keys.
                    <span className="block mt-2 font-semibold text-slate-300">Important: There is no recovery option if this password is lost.</span>
                  </p>
                </div>
              </div>
            )}

            {activeTab === "general" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400 border border-blue-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    Log Retention
                  </h2>
                  <p className="text-slate-400 mt-3 leading-relaxed max-w-lg">
                    Configure how many log entries to keep and how long to retain them.
                  </p>
                </div>

                <div className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Maximum Log Entries
                    </label>
                    <select
                      value={logRetentionLimit}
                      onChange={(e) => setLogRetentionLimit(Number(e.target.value))}
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                    >
                      <option value={100}>100 entries</option>
                      <option value={250}>250 entries</option>
                      <option value={500}>500 entries</option>
                      <option value={1000}>1,000 entries</option>
                    </select>
                    <p className="text-xs text-slate-600 pl-1">
                      Older entries will be automatically removed when the limit is reached.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Auto-clear After
                    </label>
                    <select
                      value={logRetentionDays ?? "never"}
                      onChange={(e) =>
                        setLogRetentionDays(
                          e.target.value === "never" ? null : Number(e.target.value),
                        )
                      }
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                    >
                      <option value="never">Never</option>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                    </select>
                    <p className="text-xs text-slate-600 pl-1">
                      Entries older than this will be pruned on app startup.
                    </p>
                  </div>

                  {settingsSaved && (
                    <div className="flex items-center gap-3 text-sm text-green-400 bg-green-400/5 p-4 rounded-xl border border-green-400/10 animate-in zoom-in-95 duration-200">
                      <Check className="w-5 h-5 shrink-0" />
                      Log retention settings saved.
                    </div>
                  )}

                  <button
                    onClick={handleSaveLogSettings}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 mt-6 shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}

            {activeTab !== "security" && activeTab !== "general" && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20">
                <div className="p-6 bg-white/5 rounded-full text-slate-500">
                  <Settings className="w-12 h-12 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-slate-300 capitalize">{activeTab.replace("-", " ")} Settings</h2>
                <p className="text-slate-500 max-w-sm">
                  This section is under development and will be available in a future update.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
