import { useState, useEffect, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, TERMINAL_THEMES } from "../store/useStore";
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
  Wifi,
  Clock,
  HardDrive,
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
  const [sshTimeout, setSshTimeout] = useState(settings.sshConnectionTimeout ?? 15);
  const [sshKeepAlive, setSshKeepAlive] = useState(settings.sshKeepAliveInterval ?? 0);
  const [defaultPort, setDefaultPort] = useState(settings.defaultSSHPort ?? 22);
  const [sftpCmdTimeout, setSftpCmdTimeout] = useState(settings.sftpCommandTimeout ?? 30);
  const [sftpXferTimeout, setSftpXferTimeout] = useState(settings.sftpTransferTimeout ?? 600);
  const [sshSftpSaved, setSshSftpSaved] = useState(false);

  useEffect(() => {
    setLogRetentionLimit(settings.logRetentionLimit);
    setLogRetentionDays(settings.logRetentionDays);
    setSshTimeout(settings.sshConnectionTimeout ?? 15);
    setSshKeepAlive(settings.sshKeepAliveInterval ?? 0);
    setDefaultPort(settings.defaultSSHPort ?? 22);
    setSftpCmdTimeout(settings.sftpCommandTimeout ?? 30);
    setSftpXferTimeout(settings.sftpTransferTimeout ?? 600);
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

  const handleSaveSshSftpSettings = async () => {
    const newSettings = {
      ...settings,
      sshConnectionTimeout: sshTimeout,
      sshKeepAliveInterval: sshKeepAlive,
      defaultSSHPort: defaultPort,
      sftpCommandTimeout: sftpCmdTimeout,
      sftpTransferTimeout: sftpXferTimeout,
    };
    setSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
      setSshSftpSaved(true);
      setTimeout(() => setSshSftpSaved(false), 2000);
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
                    <label htmlFor="log-limit" className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Maximum Log Entries
                    </label>
                    <select
                      id="log-limit"
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
                    <label htmlFor="log-days" className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Auto-clear After
                    </label>
                    <select
                      id="log-days"
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

            {activeTab === "appearance" && (
              <div className="space-y-12 pb-20">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-purple-600/10 rounded-lg text-purple-400 border border-purple-500/20">
                      <Monitor className="w-5 h-5" />
                    </div>
                    Appearance
                  </h2>
                  <p className="text-slate-400 mt-3 leading-relaxed max-w-lg">
                    Customize your terminal's visual style, including color schemes, fonts, and layout.
                  </p>
                </div>

                {/* Terminal Theme Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Terminal Theme</h3>
                    <p className="text-xs text-slate-500 mt-1">Select a color preset for all terminal sessions.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(TERMINAL_THEMES).map(([id, { name, theme }]) => {
                      const isSelected = settings.terminalThemeId === id;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            const newSettings = { 
                              ...settings, 
                              terminalTheme: theme, 
                              terminalThemeId: id 
                            };
                            setSettings(newSettings);
                            invoke("save_settings", { settings: newSettings });
                          }}
                          className={`group relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                            isSelected 
                              ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10" 
                              : "border-white/5 bg-white/2 hover:border-white/20 hover:bg-white/4"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-3">
                            <span className={`text-sm font-semibold transition-colors ${isSelected ? "text-blue-400" : "text-slate-300"}`}>
                              {name}
                            </span>
                            {isSelected && (
                              <div className="bg-blue-500 rounded-full p-1">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          
                          {/* Mini Preview */}
                          <div 
                            className="w-full h-16 rounded-lg p-2 flex flex-col gap-1 overflow-hidden" 
                            style={{ backgroundColor: theme.background }}
                          >
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.red }}></div>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.green }}></div>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.yellow }}></div>
                            </div>
                            <div className="h-2 w-3/4 rounded-sm" style={{ backgroundColor: theme.foreground, opacity: 0.3 }}></div>
                            <div className="h-2 w-1/2 rounded-sm" style={{ backgroundColor: theme.blue, opacity: 0.5 }}></div>
                            <div className="h-2 w-2/3 rounded-sm" style={{ backgroundColor: theme.magenta, opacity: 0.4 }}></div>
                          </div>

                          {/* Hover Overlay */}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Settings */}
                <div className="space-y-8 pt-4">
                  <div className="border-t border-white/5 pt-8">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Typography</h3>
                    <p className="text-xs text-slate-500 mt-1">Configure terminal font family and scale.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Font Size */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Font Size
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="10"
                          max="24"
                          step="1"
                          value={settings.terminalFontSize}
                          onChange={(e) => {
                            const newSettings = { ...settings, terminalFontSize: Number(e.target.value) };
                            setSettings(newSettings);
                            invoke("save_settings", { settings: newSettings });
                          }}
                          className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-sm font-mono text-slate-300 w-8 text-center">{settings.terminalFontSize}px</span>
                      </div>
                    </div>

                    {/* Font Family */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Font Family
                      </label>
                      <select
                        value={settings.terminalFontFamily}
                        onChange={(e) => {
                          const newSettings = { ...settings, terminalFontFamily: e.target.value };
                          setSettings(newSettings);
                          invoke("save_settings", { settings: newSettings });
                        }}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                      >
                        <option value="'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace">JetBrains Mono</option>
                        <option value="'Fira Code', 'JetBrains Mono', monospace">Fira Code</option>
                        <option value="'Cascadia Code', 'Consolas', monospace">Cascadia Code</option>
                        <option value="Menlo, Monaco, 'Courier New', monospace">System Default</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Terminal Behavior */}
                <div className="space-y-8 pt-4">
                  <div className="border-t border-white/5 pt-8">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Terminal Behavior</h3>
                    <p className="text-xs text-slate-500 mt-1">Configure cursor, scrollback, and line spacing. Changes apply to new terminal sessions.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Cursor Style */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Cursor Style
                      </label>
                      <select
                        value={settings.terminalCursorStyle ?? "bar"}
                        onChange={(e) => {
                          const newSettings = { ...settings, terminalCursorStyle: e.target.value as "bar" | "block" | "underline" };
                          setSettings(newSettings);
                          invoke("save_settings", { settings: newSettings });
                        }}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                      >
                        <option value="bar">Bar</option>
                        <option value="block">Block</option>
                        <option value="underline">Underline</option>
                      </select>
                    </div>

                    {/* Cursor Blink */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Cursor Blink
                      </label>
                      <button
                        onClick={() => {
                          const newSettings = { ...settings, terminalCursorBlink: !(settings.terminalCursorBlink ?? true) };
                          setSettings(newSettings);
                          invoke("save_settings", { settings: newSettings });
                        }}
                        className="flex items-center gap-3 w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 transition-all"
                      >
                        <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                          (settings.terminalCursorBlink ?? true) ? "bg-blue-500" : "bg-white/10"
                        }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            (settings.terminalCursorBlink ?? true) ? "translate-x-5" : "translate-x-0.5"
                          }`} />
                        </div>
                        <span className="text-sm text-slate-300">
                          {(settings.terminalCursorBlink ?? true) ? "Enabled" : "Disabled"}
                        </span>
                      </button>
                    </div>

                    {/* Line Height */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Line Height
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1.0"
                          max="2.0"
                          step="0.1"
                          value={settings.terminalLineHeight ?? 1.2}
                          onChange={(e) => {
                            const newSettings = { ...settings, terminalLineHeight: Number(e.target.value) };
                            setSettings(newSettings);
                            invoke("save_settings", { settings: newSettings });
                          }}
                          className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-sm font-mono text-slate-300 w-8 text-center">{(settings.terminalLineHeight ?? 1.2).toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Scrollback Buffer */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Scrollback Buffer
                      </label>
                      <select
                        value={settings.terminalScrollback ?? 5000}
                        onChange={(e) => {
                          const newSettings = { ...settings, terminalScrollback: Number(e.target.value) };
                          setSettings(newSettings);
                          invoke("save_settings", { settings: newSettings });
                        }}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                      >
                        <option value={1000}>1,000 lines</option>
                        <option value={5000}>5,000 lines</option>
                        <option value={10000}>10,000 lines</option>
                        <option value={50000}>50,000 lines</option>
                        <option value={0}>Unlimited</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ssh-sftp" && (
              <div className="space-y-12 pb-20">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                      <Wifi className="w-5 h-5" />
                    </div>
                    SSH Connection
                  </h2>
                  <p className="text-slate-400 mt-3 leading-relaxed max-w-lg">
                    Configure default SSH connection parameters and keep-alive behavior.
                  </p>
                </div>

                <div className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Connection Timeout
                    </label>
                    <select
                      value={sshTimeout}
                      onChange={(e) => setSshTimeout(Number(e.target.value))}
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                    >
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                    </select>
                    <p className="text-xs text-slate-600 pl-1">
                      Maximum time to wait when establishing an SSH connection.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Keep-Alive Interval
                    </label>
                    <select
                      value={sshKeepAlive}
                      onChange={(e) => setSshKeepAlive(Number(e.target.value))}
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                    >
                      <option value={0}>Disabled</option>
                      <option value={15}>Every 15 seconds</option>
                      <option value={30}>Every 30 seconds</option>
                      <option value={60}>Every 60 seconds</option>
                      <option value={120}>Every 120 seconds</option>
                    </select>
                    <p className="text-xs text-slate-600 pl-1">
                      Send periodic keep-alive packets to prevent idle disconnects.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                      Default Port
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={defaultPort}
                      onChange={(e) => setDefaultPort(Number(e.target.value))}
                      className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 placeholder-slate-600"
                      placeholder="22"
                    />
                    <p className="text-xs text-slate-600 pl-1">
                      Default port used when adding new hosts (1-65535).
                    </p>
                  </div>
                </div>

                {/* SFTP Timeouts */}
                <div className="space-y-6">
                  <div className="border-t border-white/5 pt-8">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      SFTP Timeouts
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Set timeout limits for file operations and transfers.</p>
                  </div>

                  <div className="max-w-md space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Command Timeout
                      </label>
                      <select
                        value={sftpCmdTimeout}
                        onChange={(e) => setSftpCmdTimeout(Number(e.target.value))}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                      >
                        <option value={15}>15 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                        <option value={120}>120 seconds</option>
                      </select>
                      <p className="text-xs text-slate-600 pl-1">
                        Timeout for SFTP commands like listing directories and creating folders.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">
                        Transfer Timeout
                      </label>
                      <select
                        value={sftpXferTimeout}
                        onChange={(e) => setSftpXferTimeout(Number(e.target.value))}
                        className="w-full bg-navy-sidebar border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-100 appearance-none cursor-pointer"
                      >
                        <option value={300}>5 minutes</option>
                        <option value={600}>10 minutes</option>
                        <option value={1800}>30 minutes</option>
                        <option value={3600}>60 minutes</option>
                        <option value={0}>Unlimited</option>
                      </select>
                      <p className="text-xs text-slate-600 pl-1">
                        Maximum time allowed for file uploads and downloads.
                      </p>
                    </div>

                    {sshSftpSaved && (
                      <div className="flex items-center gap-3 text-sm text-green-400 bg-green-400/5 p-4 rounded-xl border border-green-400/10 animate-in zoom-in-95 duration-200">
                        <Check className="w-5 h-5 shrink-0" />
                        SSH & SFTP settings saved.
                      </div>
                    )}

                    <button
                      onClick={handleSaveSshSftpSettings}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 mt-6 shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
