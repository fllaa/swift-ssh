import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { logActivity } from "../lib/activityLog";

interface UnlockModalProps {
  readonly onUnlocked: () => void;
}

export default function UnlockModal({ onUnlocked }: UnlockModalProps) {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    invoke<{ initialized: boolean; unlocked: boolean }>("vault_status")
      .then((status) => {
        if (status.unlocked) {
          onUnlocked();
        } else {
          setIsInitialized(status.initialized);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isInitialized !== null) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isInitialized]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      await invoke("unlock_vault", { password });
      logActivity("vault", "unlock", "Vault unlocked");
      onUnlocked();
    } catch (err) {
      setError(String(err));
      triggerShake();
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const handleInit = async () => {
    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters");
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      triggerShake();
      return;
    }
    setLoading(true);
    setError("");
    try {
      await invoke("init_vault", { password });
      logActivity("vault", "init", "Vault initialized");
      onUnlocked();
    } catch (err) {
      setError(String(err));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: globalThis.React.FormEvent) => {
    e.preventDefault();
    if (isInitialized) {
      handleUnlock();
    } else {
      handleInit();
    }
  };

  if (isInitialized === null) {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-space-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-space-dark">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div
        className={`relative w-full max-w-md mx-4 transition-transform ${shake ? "animate-shake" : ""}`}
      >
        {/* Card */}
        <div className="bg-card-slate/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center pt-10 pb-6 px-8">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/10">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-1.5">
              {isInitialized ? "Unlock Vault" : "Create Master Password"}
            </h1>
            <p className="text-slate-400 text-sm text-center max-w-xs">
              {isInitialized
                ? "Enter your master password to access your saved credentials"
                : "Set a master password to encrypt and protect your SSH credentials"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {/* Password Input */}
            <div>
              <label htmlFor="vault-password" className="block text-sm font-semibold text-slate-300 mb-1.5">
                {isInitialized ? "Master Password" : "New Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  id="vault-password"
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-space-dark border border-slate-800 rounded-xl text-white pl-10 pr-12 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4.5 h-4.5" />
                  ) : (
                    <Eye className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (only for init) */}
            {!isInitialized && (
              <div>
                <label htmlFor="vault-confirm-password" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="vault-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="••••••••"
                    className="w-full bg-space-dark border border-slate-800 rounded-xl text-white pl-10 pr-4 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-12 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {isInitialized ? "Unlocking..." : "Creating..."}
                  </span>
                </>
              ) : (
                <span>
                  {isInitialized ? "Unlock" : "Create Password"}
                </span>
              )}
            </button>

            {/* Warning for init */}
            {!isInitialized && (
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                ⚠️ There is no password recovery. If you forget this password,
                you will need to re-enter all credentials.
              </p>
            )}
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
