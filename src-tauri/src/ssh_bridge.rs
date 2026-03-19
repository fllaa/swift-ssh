use base64::Engine;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use tauri::{AppHandle, Emitter};

use crate::secure_storage;

pub fn storage_dir() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("SwiftSSH")
}

/// Returns (python_binary, script_path) for a given sidecar script name.
/// Uses the bundled venv Python so paramiko is always available.
pub fn sidecar_paths_for(script_name: &str) -> (PathBuf, PathBuf) {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .to_path_buf();

    let sidecar_dir = project_root.join("sidecar");
    let script = sidecar_dir.join(script_name);
    let venv_python = sidecar_dir.join(".venv").join("bin").join("python3");

    if venv_python.exists() && script.exists() {
        eprintln!("[ssh_bridge] using venv python: {:?}", venv_python);
        return (venv_python, script);
    }

    // Production: look relative to the executable
    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
        let prod_sidecar = exe_dir.join("sidecar");
        let prod_script = prod_sidecar.join(script_name);
        let prod_venv = prod_sidecar.join(".venv").join("bin").join("python3");
        if prod_venv.exists() && prod_script.exists() {
            eprintln!("[ssh_bridge] using prod venv python: {:?}", prod_venv);
            return (prod_venv, prod_script);
        }
        if prod_script.exists() {
            eprintln!("[ssh_bridge] WARNING: no venv found, using system python3");
            return (PathBuf::from("python3"), prod_script);
        }
    }

    eprintln!("[ssh_bridge] WARNING: using fallback paths");
    (PathBuf::from("python3"), PathBuf::from(format!("sidecar/{}", script_name)))
}

/// Convenience: returns paths for the SSH terminal sidecar (main.py).
pub fn sidecar_paths() -> (PathBuf, PathBuf) {
    sidecar_paths_for("main.py")
}

struct Session {
    process: Child,
    stdin: ChildStdin,
}

pub struct SshBridge {
    sessions: HashMap<String, Session>,
    app: AppHandle,
}

impl SshBridge {
    pub fn new(app: AppHandle) -> Self {
        Self {
            sessions: HashMap::new(),
            app,
        }
    }

    pub async fn connect(&mut self, host_id: &str, enc_key: Option<&[u8; 32]>) -> Result<String, String> {
        eprintln!("[ssh_bridge] connect: host_id={}", host_id);

        let storage = storage_dir();
        let hosts_path = storage.join("hosts.json");
        let data = std::fs::read_to_string(&hosts_path).map_err(|e| e.to_string())?;
        let hosts: Vec<Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        let mut host = hosts
            .iter()
            .find(|h| h.get("id").and_then(|v| v.as_str()) == Some(host_id))
            .ok_or("Host not found")?
            .clone();

        // Decrypt password field if encrypted
        if let Some(key) = enc_key {
            let _ = secure_storage::decrypt_sensitive_fields(&mut host, key, &["password"]);
        }

        let session_id = uuid::Uuid::new_v4().to_string();

        let mut key_content: Option<String> = None;
        if host.get("authMethod").and_then(|v| v.as_str()) == Some("key") {
            if let Some(key_id) = host.get("keyId").and_then(|v| v.as_str()) {
                let keys_path = storage.join("keys.json");
                if keys_path.exists() {
                    let kdata = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
                    let mut keys: Vec<Value> = serde_json::from_str(&kdata).unwrap_or_default();
                    // Decrypt private key fields
                    if let Some(ek) = enc_key {
                        for k in keys.iter_mut() {
                            let _ = secure_storage::decrypt_sensitive_fields(k, ek, &["privateKey"]);
                        }
                    }
                    if let Some(key) = keys.iter().find(|k| k.get("id").and_then(|v| v.as_str()) == Some(key_id)) {
                        key_content = key.get("privateKey").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                }
            }
        }

        let mut rules_json: Option<String> = None;
        let rules_path = storage.join("port_forwarding_rules.json");
        if rules_path.exists() {
            if let Ok(rdata) = std::fs::read_to_string(&rules_path) {
                if let Ok(rules) = serde_json::from_str::<Vec<Value>>(&rdata) {
                    let host_rules: Vec<Value> = rules.into_iter()
                        .filter(|r| r.get("hostId").and_then(|v| v.as_str()) == Some(host_id) && r.get("enabled").and_then(|v| v.as_bool()) == Some(true))
                        .collect();
                    if !host_rules.is_empty() {
                        rules_json = Some(serde_json::to_string(&host_rules).unwrap_or_default());
                    }
                }
            }
        }

        let host_json = serde_json::to_string(&host).map_err(|e| e.to_string())?;
        let (python_bin, script) = sidecar_paths();
        let python_str = python_bin.to_str().unwrap_or("python3");
        let script_str = script.to_str().unwrap_or("sidecar/main.py");

        eprintln!("[ssh_bridge] spawning sidecar: {} {}", python_str, script_str);

        let mut cmd = Command::new(python_str);
        cmd.arg("-u")
            .arg(script_str)
            .arg("--host-json")
            .arg(&host_json)
            .arg("--session-id")
            .arg(&session_id)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PYTHONUNBUFFERED", "1");

        if let Some(ref rj) = rules_json {
            cmd.arg("--forwarding-json").arg(rj);
        }

        if let Some(ref kc) = key_content {
            cmd.arg("--key-content").arg(kc);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to start sidecar: {}", e))?;
        eprintln!("[ssh_bridge] sidecar spawned, pid={:?}", child.id());
        eprintln!("[ssh_bridge] session_id={}", session_id);

        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
        let stderr = child.stderr.take();

        // Spawn a thread to log stderr from the Python sidecar
        if let Some(stderr_stream) = stderr {
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr_stream);
                for line in reader.lines() {
                    match line {
                        Ok(text) => eprintln!("[sidecar stderr] {}", text),
                        Err(_) => break,
                    }
                }
            });
        }

        // Spawn a thread to read JSON lines from stdout and emit events to the frontend
        let app = self.app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            eprintln!("[ssh_bridge] reader thread started for session {}", sid);
            let reader = BufReader::new(stdout);
            let mut line_count = 0u64;

            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        line_count += 1;

                        // Try to parse as JSON
                        match serde_json::from_str::<Value>(&text) {
                            Ok(msg) => {
                                let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                let payload = msg.get("payload").and_then(|v| v.as_str()).unwrap_or("");

                                match msg_type {
                                    "data" => {
                                        match base64::engine::general_purpose::STANDARD.decode(payload) {
                                            Ok(bytes) => {
                                                let decoded = String::from_utf8_lossy(&bytes).to_string();
                                                let emit_result = app.emit(
                                                    "ssh-output",
                                                    serde_json::json!({"sessionId": sid, "data": decoded}),
                                                );
                                                if let Err(e) = emit_result {
                                                    eprintln!("[ssh_bridge] ERROR emitting ssh-output: {}", e);
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("[ssh_bridge] ERROR base64 decode failed: {}", e);
                                            }
                                        }
                                    }
                                    "status" => {
                                        eprintln!("[ssh_bridge] status message: {}", payload);
                                        if payload == "disconnected" {
                                            let _ = app.emit(
                                                "ssh-output",
                                                serde_json::json!({"sessionId": sid, "data": "\r\n[Connection closed]\r\n"}),
                                            );
                                            break;
                                        } else if let Some(err_msg) = payload.strip_prefix("error:") {
                                            let _ = app.emit(
                                                "ssh-output",
                                                serde_json::json!({"sessionId": sid, "data": format!("\r\n[Error] {}\r\n", err_msg)}),
                                            );
                                            break;
                                        }
                                    }
                                    _ => {
                                        eprintln!("[ssh_bridge] unknown msg type: {}", msg_type);
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("[ssh_bridge] ERROR: failed to parse JSON: {} — raw line: {}", e, &text[..text.len().min(200)]);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[ssh_bridge] reader error: {}", e);
                        break;
                    }
                }
            }
            eprintln!("[ssh_bridge] reader thread ended for session {} after {} lines", sid, line_count);
            let _ = app.emit(
                "ssh-disconnected",
                serde_json::json!({"sessionId": sid}),
            );
        });

        self.sessions.insert(
            session_id.clone(),
            Session {
                process: child,
                stdin,
            },
        );

        eprintln!("[ssh_bridge] connect() done, session={}", session_id);
        Ok(session_id)
    }

    pub async fn disconnect(&mut self, session_id: &str) -> Result<(), String> {
        eprintln!("[ssh_bridge] disconnect called for session {}", session_id);
        if let Some(mut session) = self.sessions.remove(session_id) {
            let _ = session.process.kill();
        }
        Ok(())
    }

    pub async fn send_input(&self, session_id: &str, data: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.get(session_id) {
            let encoded = base64::engine::general_purpose::STANDARD.encode(data.as_bytes());
            let mut stdin = &session.stdin;
            stdin
                .write_all(format!("{}\n", encoded).as_bytes())
                .map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }
}
