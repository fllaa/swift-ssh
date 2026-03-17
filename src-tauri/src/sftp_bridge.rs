use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use tauri::{AppHandle, Emitter};

use crate::ssh_bridge;

struct SftpSession {
    process: Child,
    stdin: ChildStdin,
}

pub struct SftpBridge {
    sessions: HashMap<String, SftpSession>,
    app: AppHandle,
}

impl SftpBridge {
    pub fn new(app: AppHandle) -> Self {
        Self {
            sessions: HashMap::new(),
            app,
        }
    }

    pub async fn connect(&mut self, host_id: &str) -> Result<String, String> {
        eprintln!("[sftp_bridge] connect: host_id={}", host_id);

        let storage = ssh_bridge::storage_dir();
        let hosts_path = storage.join("hosts.json");
        let data = std::fs::read_to_string(&hosts_path).map_err(|e| e.to_string())?;
        let hosts: Vec<Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        let host = hosts
            .iter()
            .find(|h| h.get("id").and_then(|v| v.as_str()) == Some(host_id))
            .ok_or("Host not found")?
            .clone();

        let session_id = uuid::Uuid::new_v4().to_string();

        let mut key_content: Option<String> = None;
        if host.get("authMethod").and_then(|v| v.as_str()) == Some("key") {
            if let Some(key_id) = host.get("keyId").and_then(|v| v.as_str()) {
                let keys_path = storage.join("keys.json");
                if keys_path.exists() {
                    let kdata =
                        std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
                    let keys: Vec<Value> = serde_json::from_str(&kdata).unwrap_or_default();
                    if let Some(key) = keys
                        .iter()
                        .find(|k| k.get("id").and_then(|v| v.as_str()) == Some(key_id))
                    {
                        key_content = key
                            .get("privateKey")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            }
        }

        let host_json = serde_json::to_string(&host).map_err(|e| e.to_string())?;
        let (python_bin, script) = ssh_bridge::sidecar_paths_for("sftp.py");
        let python_str = python_bin.to_str().unwrap_or("python3");
        let script_str = script.to_str().unwrap_or("sidecar/sftp.py");

        eprintln!(
            "[sftp_bridge] spawning sidecar: {} {}",
            python_str, script_str
        );

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

        if let Some(ref kc) = key_content {
            cmd.arg("--key-content").arg(kc);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start SFTP sidecar: {}", e))?;

        eprintln!(
            "[sftp_bridge] sidecar spawned, pid={:?}, session_id={}",
            child.id(),
            session_id
        );

        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
        let stderr = child.stderr.take();

        // Spawn stderr logger
        if let Some(stderr_stream) = stderr {
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr_stream);
                for line in reader.lines() {
                    match line {
                        Ok(text) => eprintln!("[sftp-sidecar stderr] {}", text),
                        Err(_) => break,
                    }
                }
            });
        }

        // Spawn stdout reader — emits sftp-response and sftp-disconnected events
        let app = self.app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            eprintln!(
                "[sftp_bridge] reader thread started for session {}",
                sid
            );
            let reader = BufReader::new(stdout);

            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        match serde_json::from_str::<Value>(&text) {
                            Ok(msg) => {
                                let msg_type =
                                    msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

                                match msg_type {
                                    "result" | "error" => {
                                        // Forward the full message with sessionId added
                                        let mut response = msg.clone();
                                        if let Some(obj) = response.as_object_mut() {
                                            obj.insert(
                                                "sessionId".to_string(),
                                                Value::String(sid.clone()),
                                            );
                                        }
                                        let _ = app.emit("sftp-response", response);
                                    }
                                    "progress" => {
                                        let mut response = msg.clone();
                                        if let Some(obj) = response.as_object_mut() {
                                            obj.insert(
                                                "sessionId".to_string(),
                                                Value::String(sid.clone()),
                                            );
                                        }
                                        let _ = app.emit("sftp-progress", response);
                                    }
                                    "status" => {
                                        let payload = msg
                                            .get("payload")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        eprintln!(
                                            "[sftp_bridge] status: {}",
                                            payload
                                        );

                                        if payload == "connected" {
                                            let _ = app.emit(
                                                "sftp-connected",
                                                serde_json::json!({"sessionId": sid}),
                                            );
                                        } else if payload == "disconnected" {
                                            let _ = app.emit(
                                                "sftp-disconnected",
                                                serde_json::json!({"sessionId": sid}),
                                            );
                                            break;
                                        } else if let Some(err_msg) =
                                            payload.strip_prefix("error:")
                                        {
                                            let _ = app.emit(
                                                "sftp-disconnected",
                                                serde_json::json!({"sessionId": sid, "error": err_msg}),
                                            );
                                            break;
                                        }
                                    }
                                    _ => {
                                        eprintln!(
                                            "[sftp_bridge] unknown msg type: {}",
                                            msg_type
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!(
                                    "[sftp_bridge] failed to parse JSON: {} — raw: {}",
                                    e,
                                    &text[..text.len().min(200)]
                                );
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[sftp_bridge] reader error: {}", e);
                        break;
                    }
                }
            }

            eprintln!(
                "[sftp_bridge] reader thread ended for session {}",
                sid
            );
            let _ = app.emit(
                "sftp-disconnected",
                serde_json::json!({"sessionId": sid}),
            );
        });

        self.sessions.insert(
            session_id.clone(),
            SftpSession {
                process: child,
                stdin,
            },
        );

        eprintln!("[sftp_bridge] connect() done, session={}", session_id);
        Ok(session_id)
    }

    pub async fn disconnect(&mut self, session_id: &str) -> Result<(), String> {
        eprintln!(
            "[sftp_bridge] disconnect called for session {}",
            session_id
        );
        if let Some(mut session) = self.sessions.remove(session_id) {
            let _ = session.process.kill();
        }
        Ok(())
    }

    pub fn send_command(&self, session_id: &str, command: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.get(session_id) {
            let mut stdin = &session.stdin;
            stdin
                .write_all(format!("{}\n", command).as_bytes())
                .map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("SFTP session not found".to_string())
        }
    }
}
