import { AlertCircle, RefreshCw, Settings, XCircle } from "lucide-react";

export type SSHErrorType = 'auth' | 'timeout' | 'disconnected' | 'key' | 'generic';

interface SSHErrorOverlayProps {
  readonly errorType: SSHErrorType;
  readonly errorMessage: string;
  readonly hostName: string;
  readonly onReconnect: () => void;
  readonly onEditHost: () => void;
  readonly onCloseTab: () => void;
}

export default function SSHErrorOverlay({
  errorType,
  errorMessage,
  hostName,
  onReconnect,
  onEditHost,
  onCloseTab,
}: SSHErrorOverlayProps) {
  let title = "Connection Error";
  let description = errorMessage;

  if (errorType === 'auth') {
    title = "Authentication Failed";
    description = "The provided password or private key was rejected by the server.";
  } else if (errorType === 'timeout') {
    title = "Connection Timeout";
    description = "The server is unreachable or timed out.";
  } else if (errorType === 'disconnected') {
    title = "Session Disconnected";
    description = "The SSH connection was dropped unexpectedly.";
  } else if (errorType === 'key') {
    title = "Invalid Private Key";
    description = errorMessage.includes("passphrase")
      ? "This key requires a passphrase, which is currently unsupported."
      : "The provided private key format is unsupported or invalid.";
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm">
      <div className="bg-[#1e2130] border border-slate-700/50 rounded-xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">
              Could not connect to <span className="text-slate-200 font-medium">{hostName}</span>
            </p>
          </div>

          <div className="bg-[#151822] border border-red-500/20 rounded-lg p-3 w-full text-left">
            <p className="text-xs text-red-300/80 font-mono wrap-break-word">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full pt-4">
            <button
              onClick={onCloseTab}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Close
            </button>

            {errorType !== 'disconnected' && (
              <button
                onClick={onEditHost}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Edit Host
              </button>
            )}

            <button
              onClick={onReconnect}
              className="flex-1 px-4 py-2 bg-accent-blue hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
