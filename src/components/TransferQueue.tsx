import { useStore } from "../store/useStore";
import {
  Upload,
  Download,
  X,
  Check,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { formatFileSize } from "../utils/fileIcons";

export default function TransferQueue() {
  const { transfers, removeTransfer, clearCompletedTransfers } = useStore();

  if (transfers.length === 0) return null;

  const activeCount = transfers.filter(
    (t) => t.status === "active" || t.status === "queued"
  ).length;
  const completedCount = transfers.filter(
    (t) => t.status === "completed" || t.status === "failed"
  ).length;

  return (
    <div className="border-t border-slate-800 bg-[#161d2b]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Transfers
          </span>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompletedTransfers}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Transfer list */}
      <div className="max-h-32 overflow-y-auto">
        {transfers.map((transfer) => {
          const progress =
            transfer.totalBytes > 0
              ? Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100)
              : 0;
          const speed =
            transfer.status === "active" && transfer.startedAt
              ? transfer.bytesTransferred /
                ((Date.now() - transfer.startedAt) / 1000)
              : 0;

          return (
            <div
              key={transfer.id}
              className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-800/30 transition-colors"
            >
              {/* Direction icon */}
              <div
                className={`shrink-0 ${
                  transfer.direction === "upload"
                    ? "text-green-400"
                    : "text-blue-400"
                }`}
              >
                {transfer.direction === "upload" ? (
                  <Upload className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </div>

              {/* File info + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white truncate">
                    {transfer.fileName}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {transfer.status === "active" && `${progress}%`}
                    {transfer.status === "completed" && "Done"}
                    {transfer.status === "failed" && "Failed"}
                    {transfer.status === "queued" && "Queued"}
                  </span>
                </div>

                {/* Progress bar */}
                {(transfer.status === "active" ||
                  transfer.status === "queued") && (
                  <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        transfer.direction === "upload"
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Speed + size info */}
                {transfer.status === "active" && speed > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">
                      {formatFileSize(transfer.bytesTransferred)} /{" "}
                      {formatFileSize(transfer.totalBytes)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatFileSize(speed)}/s
                    </span>
                  </div>
                )}

                {/* Error message */}
                {transfer.status === "failed" && transfer.error && (
                  <span className="text-[10px] text-red-400 truncate block">
                    {transfer.error}
                  </span>
                )}
              </div>

              {/* Status icon / actions */}
              <div className="shrink-0">
                {transfer.status === "completed" && (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                )}
                {transfer.status === "failed" && (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                )}
                {(transfer.status === "completed" ||
                  transfer.status === "failed") && (
                  <button
                    onClick={() => removeTransfer(transfer.id)}
                    className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
