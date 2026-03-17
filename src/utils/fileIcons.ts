import {
  File,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileJson,
  Folder,
  FolderOpen,
  Link,
  type LucideIcon,
} from "lucide-react";

const EXTENSION_MAP: Record<string, LucideIcon> = {
  // Code
  ".js": FileCode,
  ".jsx": FileCode,
  ".ts": FileCode,
  ".tsx": FileCode,
  ".py": FileCode,
  ".rs": FileCode,
  ".go": FileCode,
  ".rb": FileCode,
  ".java": FileCode,
  ".c": FileCode,
  ".cpp": FileCode,
  ".h": FileCode,
  ".hpp": FileCode,
  ".cs": FileCode,
  ".php": FileCode,
  ".swift": FileCode,
  ".kt": FileCode,
  ".scala": FileCode,
  ".sh": FileCode,
  ".bash": FileCode,
  ".zsh": FileCode,
  ".fish": FileCode,
  ".ps1": FileCode,
  ".bat": FileCode,
  ".cmd": FileCode,
  ".lua": FileCode,
  ".pl": FileCode,
  ".r": FileCode,
  ".sql": FileCode,
  ".html": FileCode,
  ".htm": FileCode,
  ".css": FileCode,
  ".scss": FileCode,
  ".less": FileCode,
  ".vue": FileCode,
  ".svelte": FileCode,
  ".xml": FileCode,
  ".toml": FileCode,
  ".yaml": FileCode,
  ".yml": FileCode,
  ".ini": FileCode,
  ".cfg": FileCode,
  ".conf": FileCode,

  // JSON
  ".json": FileJson,
  ".jsonl": FileJson,
  ".jsonc": FileJson,

  // Text / Docs
  ".txt": FileText,
  ".md": FileText,
  ".mdx": FileText,
  ".rst": FileText,
  ".log": FileText,
  ".csv": FileSpreadsheet,
  ".tsv": FileSpreadsheet,
  ".doc": FileText,
  ".docx": FileText,
  ".pdf": FileText,
  ".rtf": FileText,

  // Spreadsheets
  ".xls": FileSpreadsheet,
  ".xlsx": FileSpreadsheet,
  ".ods": FileSpreadsheet,

  // Images
  ".png": FileImage,
  ".jpg": FileImage,
  ".jpeg": FileImage,
  ".gif": FileImage,
  ".svg": FileImage,
  ".webp": FileImage,
  ".ico": FileImage,
  ".bmp": FileImage,
  ".tiff": FileImage,
  ".tif": FileImage,
  ".avif": FileImage,

  // Video
  ".mp4": FileVideo,
  ".mkv": FileVideo,
  ".avi": FileVideo,
  ".mov": FileVideo,
  ".wmv": FileVideo,
  ".webm": FileVideo,
  ".flv": FileVideo,

  // Audio
  ".mp3": FileAudio,
  ".wav": FileAudio,
  ".flac": FileAudio,
  ".aac": FileAudio,
  ".ogg": FileAudio,
  ".wma": FileAudio,
  ".m4a": FileAudio,

  // Archives
  ".zip": FileArchive,
  ".tar": FileArchive,
  ".gz": FileArchive,
  ".bz2": FileArchive,
  ".xz": FileArchive,
  ".7z": FileArchive,
  ".rar": FileArchive,
  ".tgz": FileArchive,
  ".zst": FileArchive,
  ".deb": FileArchive,
  ".rpm": FileArchive,
};

export function getFileIcon(
  name: string,
  isDir: boolean,
  isSymlink: boolean,
  isOpen?: boolean
): LucideIcon {
  if (isSymlink) return Link;
  if (isDir) return isOpen ? FolderOpen : Folder;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = name.slice(dotIndex).toLowerCase();
    const icon = EXTENSION_MAP[ext];
    if (icon) return icon;
  }

  return File;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  const month = date.toLocaleString("en", { month: "short" });
  const day = date.getDate();
  const time = date.toLocaleString("en", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (isThisYear) {
    return `${month} ${day} ${time}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}
