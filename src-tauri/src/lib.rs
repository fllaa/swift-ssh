mod ssh_bridge;

use ssh_bridge::SshBridge;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let bridge = Arc::new(Mutex::new(SshBridge::new(app.handle().clone())));
            app.manage(bridge);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_hosts,
            save_host,
            delete_host,
            list_keys,
            save_key,
            delete_key,
            list_groups,
            save_group,
            delete_group,
            connect_host,
            disconnect_host,
            send_input,
            test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Host CRUD ──────────────────────────────────────────

#[tauri::command]
async fn list_hosts() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("hosts.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let hosts: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(hosts)
}

#[tauri::command]
async fn save_host(profile: serde_json::Value) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("hosts.json");

    let mut hosts: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    let id = profile.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if let Some(pos) = hosts.iter().position(|h| h.get("id").and_then(|v| v.as_str()) == Some(&id)) {
        hosts[pos] = profile;
    } else {
        hosts.push(profile);
    }

    let data = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_host(host_id: String) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("hosts.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut hosts: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    hosts.retain(|h| h.get("id").and_then(|v| v.as_str()) != Some(&host_id));
    let data = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Key CRUD ───────────────────────────────────────────

#[tauri::command]
async fn list_keys() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("keys.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let keys: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(keys)
}

#[tauri::command]
async fn save_key(name: String, private_key_content: String) -> Result<serde_json::Value, String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("keys.json");

    let mut keys: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    let id = uuid::Uuid::new_v4().to_string();
    let fingerprint = format!("SHA256:{}", &id[..12]);
    let key = serde_json::json!({
        "id": id,
        "name": name,
        "fingerprint": fingerprint,
        "privateKey": private_key_content,
    });
    keys.push(key.clone());

    let data = serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(key)
}

#[tauri::command]
async fn delete_key(key_id: String) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("keys.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut keys: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    keys.retain(|k| k.get("id").and_then(|v| v.as_str()) != Some(&key_id));
    let data = serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Group CRUD ─────────────────────────────────────────

#[tauri::command]
async fn list_groups() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("groups.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let groups: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(groups)
}

#[tauri::command]
async fn save_group(group: serde_json::Value) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("groups.json");

    let mut groups: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    let id = group.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if let Some(pos) = groups.iter().position(|g| g.get("id").and_then(|v| v.as_str()) == Some(&id)) {
        groups[pos] = group;
    } else {
        groups.push(group);
    }

    let data = serde_json::to_string_pretty(&groups).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_group(group_id: String) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("groups.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut groups: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    groups.retain(|g| g.get("id").and_then(|v| v.as_str()) != Some(&group_id));
    let data = serde_json::to_string_pretty(&groups).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Test Connection ────────────────────────────────────

#[tauri::command]
async fn test_connection(profile: serde_json::Value) -> Result<String, String> {
    let storage = ssh_bridge::storage_dir();

    // Resolve key content if using key auth
    let mut key_content: Option<String> = None;
    if profile.get("authMethod").and_then(|v| v.as_str()) == Some("key") {
        if let Some(key_id) = profile.get("keyId").and_then(|v| v.as_str()) {
            let keys_path = storage.join("keys.json");
            if keys_path.exists() {
                let kdata = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
                let keys: Vec<serde_json::Value> = serde_json::from_str(&kdata).unwrap_or_default();
                if let Some(key) = keys.iter().find(|k| k.get("id").and_then(|v| v.as_str()) == Some(key_id)) {
                    key_content = key.get("privateKey").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
        }
    }

    let host_json = serde_json::to_string(&profile).map_err(|e| e.to_string())?;

    let (python_bin, script) = ssh_bridge::sidecar_paths();
    let mut cmd = std::process::Command::new(python_bin.to_str().unwrap_or("python3"));
    cmd.arg("-u")
        .arg(script.to_str().unwrap_or("sidecar/main.py"))
        .arg("--host-json")
        .arg(&host_json)
        .arg("--session-id")
        .arg("test")
        .arg("--test")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .env("PYTHONUNBUFFERED", "1");

    if let Some(ref kc) = key_content {
        cmd.arg("--key-content").arg(kc);
    }

    let output = cmd.output().map_err(|e| format!("Failed to start sidecar: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if stdout == "OK" {
        Ok("Connection successful".to_string())
    } else if stdout.starts_with("FAIL:") {
        Err(stdout[5..].to_string())
    } else if stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() { "Unknown error".to_string() } else { stderr })
    } else {
        Err(stdout)
    }
}

// ── SSH Session Commands ───────────────────────────────

#[tauri::command]
async fn connect_host(
    host_id: String,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
) -> Result<String, String> {
    let mut bridge = state.lock().await;
    bridge.connect(&host_id).await
}

#[tauri::command]
async fn disconnect_host(
    session_id: String,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
) -> Result<(), String> {
    let mut bridge = state.lock().await;
    bridge.disconnect(&session_id).await
}

#[tauri::command]
async fn send_input(
    session_id: String,
    data: String,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
) -> Result<(), String> {
    let bridge = state.lock().await;
    bridge.send_input(&session_id, &data).await
}
