# SwiftSSH

A lightweight, cross-platform desktop SSH client built as an MVP alternative to [Termius](https://termius.com). Manage SSH host profiles, store private keys, and open multiple interactive terminal sessions — all from a clean, dark-themed interface.

![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Python](https://img.shields.io/badge/Python-3.10+-yellow) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **SSH Connection Manager** — Add, edit, and delete host profiles (hostname, port, username, auth method).
- **Password & Key Auth** — Connect using a password or an imported SSH private key (RSA, Ed25519, ECDSA).
- **Interactive Terminal** — Fully interactive xterm.js terminal with real-time input/output, cursor blinking, scrollback, and 256-color support.
- **Tabbed Sessions** — Open multiple simultaneous SSH connections in separate tabs.
- **SSH Key Manager** — Import private keys from file or paste them directly. Keys are stored locally and assignable to host profiles.
- **Persistent Storage** — All hosts and keys are saved as JSON files in your OS data directory and persist across restarts.
- **Dark Mode** — Ships with a dark color palette by default. No light mode toggle needed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri v2](https://v2.tauri.app) (Rust) |
| Frontend | [React 19](https://react.dev) + TypeScript + [Vite 6](https://vite.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| State management | [Zustand](https://zustand.docs.pmnd.rs) |
| Terminal emulator | [xterm.js](https://xtermjs.org) |
| SSH backend | Python 3 sidecar using [Paramiko](https://www.paramiko.org) |
| Storage | Plain JSON files (`hosts.json`, `keys.json`) |

---

## Prerequisites

Make sure these are installed before getting started:

| Tool | Minimum version | Install |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Rust** | 1.70+ | [rustup.rs](https://rustup.rs) |
| **Python** | 3.10+ | [python.org](https://www.python.org) |

### macOS-specific

Xcode Command Line Tools are required for Tauri to compile native code:

```bash
xcode-select --install
```

### Linux-specific

Install the system libraries Tauri depends on (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/SwiftSSH.git
cd SwiftSSH
```

### 2. Install dependencies

```bash
# Node dependencies
npm install

# Python dependencies
pip3 install -r sidecar/requirements.txt
```

### 3. Run in development mode

```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Launch the native SwiftSSH window with hot-reload enabled

### 4. Build for production

```bash
npm run tauri build
```

The compiled binary and installer will be in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
SwiftSSH/
├── src-tauri/                  # Tauri v2 Rust shell
│   ├── src/
│   │   ├── main.rs             # Application entry point
│   │   ├── lib.rs              # IPC command handlers (host/key CRUD, SSH session mgmt)
│   │   └── ssh_bridge.rs       # Spawns Python sidecar processes, manages sessions
│   ├── icons/                  # App icons for bundling
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
│
├── sidecar/                    # Python SSH backend
│   ├── main.py                 # Paramiko-based interactive SSH session manager
│   └── requirements.txt        # Python dependencies
│
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── Sidebar.tsx         # Left sidebar with Hosts/Keys tab switcher
│   │   ├── HostList.tsx        # Saved hosts list with connect/edit/delete actions
│   │   ├── AddHostModal.tsx    # Modal dialog for adding or editing a host profile
│   │   ├── KeyManager.tsx      # SSH key management (add/import/delete keys)
│   │   └── TerminalTab.tsx     # xterm.js terminal instance per SSH session
│   ├── store/
│   │   └── useStore.ts         # Zustand global state (hosts, keys, tabs)
│   ├── App.tsx                 # Root layout — sidebar, tab bar, terminal area
│   ├── index.css               # Tailwind imports, dark theme, custom scrollbars
│   ├── main.tsx                # React DOM entry point
│   └── vite-env.d.ts           # Vite type declarations
│
├── index.html                  # HTML shell
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── .gitignore
```

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + xterm.js)                                │
│                                                             │
│  HostList ──invoke──► save_host / delete_host / list_hosts  │
│  KeyManager ──invoke──► save_key / delete_key / list_keys   │
│  HostList ──invoke──► connect_host ──► returns session_id   │
│  TerminalTab ──invoke──► send_input(session_id, data)       │
│  TerminalTab ◄──listen── "ssh-output" event                 │
│  App ◄──listen── "ssh-disconnected" event                   │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri IPC (invoke / events)
┌────────────────────────▼────────────────────────────────────┐
│  Rust Backend (src-tauri)                                   │
│                                                             │
│  lib.rs ── CRUD commands read/write JSON files              │
│  ssh_bridge.rs ── spawns python3 sidecar/main.py per conn   │
│    ├── stdin  → sends user keystrokes to Python process     │
│    ├── stdout → reads SSH output, emits "ssh-output" events │
│    └── kill   → disconnect terminates the child process     │
└────────────────────────┬────────────────────────────────────┘
                         │ subprocess (stdin/stdout)
┌────────────────────────▼────────────────────────────────────┐
│  Python Sidecar (sidecar/main.py)                           │
│                                                             │
│  Receives host config via --host-json CLI argument          │
│  Opens SSH connection with Paramiko (password or key auth)  │
│  Runs interactive shell (invoke_shell)                      │
│  stdin  → forwarded as channel.send()                       │
│  stdout → channel.recv() printed line-buffered              │
└─────────────────────────────────────────────────────────────┘
```

### IPC Commands

| Command | Direction | Description |
|---|---|---|
| `list_hosts()` | React → Rust | Returns all saved host profiles |
| `save_host(profile)` | React → Rust | Creates or updates a host profile |
| `delete_host(host_id)` | React → Rust | Deletes a host profile |
| `list_keys()` | React → Rust | Returns all saved SSH keys |
| `save_key(name, private_key_content)` | React → Rust | Saves a new SSH key, returns key object with fingerprint |
| `delete_key(key_id)` | React → Rust | Deletes an SSH key |
| `connect_host(host_id)` | React → Rust → Python | Opens an SSH session, returns `session_id` |
| `disconnect_host(session_id)` | React → Rust | Kills the sidecar process for that session |
| `send_input(session_id, data)` | React → Rust → Python | Sends terminal keystrokes to the SSH channel |

### Events

| Event | Direction | Payload |
|---|---|---|
| `ssh-output` | Rust → React | `{ sessionId: string, data: string }` — terminal output |
| `ssh-disconnected` | Rust → React | `{ sessionId: string }` — session ended |

---

## Storage

All data is stored as plain JSON in your OS local data directory:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/SwiftSSH/` |
| Linux | `~/.local/share/SwiftSSH/` |
| Windows | `C:\Users\<user>\AppData\Local\SwiftSSH\` |

**Files:**
- `hosts.json` — Array of host profile objects
- `keys.json` — Array of SSH key objects (includes private key content)

> **Note:** Keys and passwords are stored in plaintext. This is an MVP — do not use this for production secrets management.

---

## UI Overview

### Layout

```
┌──────────────┬──────────────────────────────────────┐
│              │  Tab1 ● │ Tab2 ● │ Tab3 ○ │          │
│  SwiftSSH    ├──────────────────────────────────────┤
│              │                                      │
│  [Hosts|Keys]│  Interactive terminal session         │
│              │                                      │
│  ┌──────────┐│  user@server:~$ ls -la               │
│  │ Server 1 ││  total 48                            │
│  │ Server 2 ││  drwxr-xr-x  12 user user 4096 ...  │
│  │ Server 3 ││  ...                                 │
│  └──────────┘│                                      │
│              │                                      │
│  [+ Add Host]│                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Color Palette

| Element | Color |
|---|---|
| Background | `#0f1117` |
| Sidebar | `#1e2130` |
| Borders | `#2a2d3e` |
| Primary text | `#e0e0e0` |
| Secondary text | `#9ca3af` |
| Accent (blue) | `#61afef` / `#528bff` |
| Connected indicator | `#22c55e` (green) |
| Disconnected indicator | `#ef4444` (red) |

---

## Usage Guide

### Adding a Host

1. Click **+ Add Host** in the sidebar
2. Fill in the host details:
   - **Label** — A friendly name (e.g., "Production Server")
   - **Hostname/IP** — The server address
   - **Username** — SSH login user
   - **Port** — Defaults to 22
   - **Auth Method** — Choose Password or SSH Key
3. Click **Add Host**

### Connecting to a Host

Click on any host in the sidebar list. A new terminal tab will open with an active SSH session.

### Managing SSH Keys

1. Switch to the **Keys** tab in the sidebar
2. Click **+ Add Key**
3. Either paste the private key content or click **Import file** to load from disk
4. Give the key a name and click **Save Key**
5. When adding/editing a host, select the key from the dropdown under SSH Key auth

### Multiple Sessions

Each connection opens in its own tab. Click tabs to switch between sessions. The green/red dot indicates connection status. Close a tab with the **×** button — this also disconnects the session.

---

## Development

### Frontend only (no Tauri)

```bash
npm run dev
```

Opens the Vite dev server at `http://localhost:1420`. Useful for iterating on UI without recompiling Rust. Note: Tauri `invoke` calls will fail in the browser.

### Rust changes

Changes to `src-tauri/src/` are automatically detected and recompiled when running `npm run tauri dev`.

### Python sidecar changes

The Python sidecar is spawned fresh for each connection, so changes to `sidecar/main.py` take effect on the next `connect_host` call without restarting the app.

---

## Troubleshooting

### "Failed to start sidecar"

The Rust backend couldn't find or execute `python3`. Make sure:
- `python3` is in your `PATH`
- `paramiko` is installed: `pip3 install paramiko`

### "Authentication failed"

- Double-check the username and password/key
- For key auth, ensure the private key format is supported (RSA, Ed25519, or ECDSA)
- The key must be the **private** key, not the public key

### Terminal not rendering

- Make sure the frontend build includes xterm.js CSS (`@import "@xterm/xterm/css/xterm.css"` in `index.css`)
- Check the browser console (Cmd+Shift+I in the Tauri window) for errors

### Blank window on launch

- Run `npm run tauri dev` and check the terminal output for compilation errors
- Verify `dist/` was built: `npm run build`

---

## Roadmap

- [ ] SFTP file browser / transfer
- [ ] Encrypted storage for passwords and keys (OS keychain integration)
- [ ] Host groups / folders
- [ ] SSH agent forwarding
- [ ] Port forwarding (local/remote tunnels)
- [ ] Snippet / command library
- [ ] Multi-hop / jump host support
- [ ] Session logging / export
- [ ] Theme customization

---

## License

MIT
