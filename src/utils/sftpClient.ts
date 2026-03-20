import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { v4 as uuidv4 } from "uuid";
import { useStore, type FileEntry } from "../store/useStore";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

interface SftpResponseEvent {
  sessionId: string;
  id: string;
  type: "result" | "error";
  payload: any;
}

interface SftpProgressEvent {
  sessionId: string;
  id: string;
  type: "progress";
  payload: { bytes: number; total: number };
}

export type ProgressCallback = (bytes: number, total: number) => void;

export class SftpClient {
  private pending = new Map<string, PendingRequest>();
  private progressCallbacks = new Map<string, ProgressCallback>();
  private sessionId: string;
  private unlistenResponse: UnlistenFn | null = null;
  private unlistenProgress: UnlistenFn | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async init(): Promise<void> {
    this.unlistenResponse = await listen<SftpResponseEvent>(
      "sftp-response",
      (event) => {
        if (event.payload.sessionId !== this.sessionId) return;
        const reqId = event.payload.id;
        const pending = this.pending.get(reqId);
        if (!pending) return;

        this.pending.delete(reqId);
        this.progressCallbacks.delete(reqId);

        if (event.payload.type === "error") {
          pending.reject(new Error(event.payload.payload));
        } else {
          pending.resolve(event.payload.payload);
        }
      }
    );

    this.unlistenProgress = await listen<SftpProgressEvent>(
      "sftp-progress",
      (event) => {
        if (event.payload.sessionId !== this.sessionId) return;
        const cb = this.progressCallbacks.get(event.payload.id);
        if (cb) {
          cb(event.payload.payload.bytes, event.payload.payload.total);
        }
      }
    );
  }

  private async request(
    cmd: string,
    params: Record<string, any> = {},
    onProgress?: ProgressCallback
  ): Promise<any> {
    const id = uuidv4();

    if (onProgress) {
      this.progressCallbacks.set(id, onProgress);
    }

    const promise = new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const storeSettings = useStore.getState().settings;
      const isTransfer = cmd === "upload" || cmd === "download";
      const timeoutSec = isTransfer
        ? (storeSettings.sftpTransferTimeout ?? 600)
        : (storeSettings.sftpCommandTimeout ?? 30);
      if (timeoutSec > 0) {
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            this.progressCallbacks.delete(id);
            reject(new Error(`SFTP ${cmd} timed out`));
          }
        }, timeoutSec * 1000);
      }
    });

    const command = JSON.stringify({ id, cmd, ...params });
    await invoke("sftp_command", {
      sessionId: this.sessionId,
      command,
    });

    return promise;
  }

  async listDir(path: string): Promise<{ path: string; entries: FileEntry[] }> {
    return this.request("ls", { path });
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback
  ): Promise<{ localPath: string }> {
    return this.request("download", { remotePath, localPath }, onProgress);
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback
  ): Promise<{ remotePath: string }> {
    return this.request("upload", { localPath, remotePath }, onProgress);
  }

  async mkdir(path: string): Promise<void> {
    await this.request("mkdir", { path });
  }

  async rm(path: string): Promise<void> {
    await this.request("rm", { path });
  }

  async rmdir(path: string): Promise<void> {
    await this.request("rmdir", { path });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.request("rename", { oldPath, newPath });
  }

  async chmod(path: string, mode: number): Promise<void> {
    await this.request("chmod", { path, mode });
  }

  async stat(path: string): Promise<FileEntry> {
    return this.request("stat", { path });
  }

  async home(): Promise<string> {
    const result = await this.request("home");
    return result.path;
  }

  destroy(): void {
    this.unlistenResponse?.();
    this.unlistenProgress?.();
    this.pending.forEach(({ reject }) =>
      reject(new Error("SFTP client destroyed"))
    );
    this.pending.clear();
    this.progressCallbacks.clear();
  }
}
