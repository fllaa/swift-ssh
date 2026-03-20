import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => {
  let commitSha = "dev";
  try {
    commitSha = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // Default to 'dev' if git command fails
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
