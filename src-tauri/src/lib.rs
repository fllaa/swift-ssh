mod crypto;
mod secure_storage;
mod sftp_bridge;
mod ssh_bridge;

use secure_storage::SecureVault;
use sftp_bridge::SftpBridge;
use ssh_bridge::SshBridge;
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::default().build())
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
            detect_distro,
            connect_host,
            disconnect_host,
            send_input,
            test_connection,
            connect_sftp,
            disconnect_sftp,
            sftp_command,
            list_local_dir,
            get_home_dir,
            // Vault commands
            vault_status,
            init_vault,
            unlock_vault,
            lock_vault,
            list_port_forwarding_rules,
            save_port_forwarding_rule,
            delete_port_forwarding_rule,
            sync_port_forwarding,
            resize_terminal,
            list_snippets,
            save_snippet,
            delete_snippet,
            change_vault_password,
            open_settings_window,
            list_logs,
            save_log,
            clear_logs,
            get_settings,
            save_settings,
        ])
        .setup(|app| {
            let bridge = Arc::new(Mutex::new(SshBridge::new(app.handle().clone())));
            app.manage(bridge);
            let sftp = Arc::new(Mutex::new(SftpBridge::new(app.handle().clone())));
            app.manage(sftp);
            let vault = Arc::new(Mutex::new(SecureVault::new()));
            app.manage(vault);

            // Setup macOS App Menu
            #[cfg(target_os = "macos")]
            {
                let pkg_info = app.package_info();
                let app_name = &pkg_info.name;

                let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
                    .accelerator("Cmd+,")
                    .build(app)?;

                let app_menu = SubmenuBuilder::new(app, app_name)
                    .about(None)
                    .separator()
                    .item(&settings_item)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let view_menu = SubmenuBuilder::new(app, "View")
                    .fullscreen()
                    .build()?;

                let window_menu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .maximize()
                    .separator()
                    .close_window()
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                    .build()?;

                app.set_menu(menu)?;

                app.on_menu_event(move |app_handle, event| {
                    if event.id() == "settings" {
                        let _ = open_settings_window(app_handle.clone());
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Vault Commands ─────────────────────────────────────────

#[tauri::command]
async fn vault_status(
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<serde_json::Value, String> {
    let v = vault.lock().await;
    Ok(serde_json::json!({
        "initialized": SecureVault::is_initialized(),
        "unlocked": v.is_unlocked(),
    }))
}

#[tauri::command]
async fn init_vault(
    password: String,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<(), String> {
    let mut v = vault.lock().await;
    v.init(&password)
}

#[tauri::command]
async fn unlock_vault(
    password: String,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<(), String> {
    let mut v = vault.lock().await;
    v.unlock(&password)
}

#[tauri::command]
async fn lock_vault(
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<(), String> {
    let mut v = vault.lock().await;
    v.lock();
    Ok(())
}

#[tauri::command]
async fn change_vault_password(
    old_password: String,
    new_password: String,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<(), String> {
    let mut v = vault.lock().await;
    v.change_password(&old_password, &new_password)
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html".into()), // or just use the route if frontend supports it
        )
        .title("Settings")
        .inner_size(600.0, 400.0)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Host CRUD ──────────────────────────────────────────

#[tauri::command]
async fn list_hosts(
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("hosts.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut hosts: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Decrypt sensitive fields if vault is unlocked
    let v = vault.lock().await;
    if let Ok(key) = v.get_key() {
        for host in hosts.iter_mut() {
            let _ = secure_storage::decrypt_sensitive_fields(host, key, &["password"]);
        }
    }

    Ok(hosts)
}

#[tauri::command]
async fn save_host(
    mut profile: serde_json::Value,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("hosts.json");

    let mut hosts: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    // Encrypt sensitive fields before saving
    let v = vault.lock().await;
    if let Ok(key) = v.get_key() {
        secure_storage::encrypt_sensitive_fields(&mut profile, key, &["password"])?;
    }

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
async fn list_keys(
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("keys.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut keys: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Decrypt sensitive fields if vault is unlocked
    let v = vault.lock().await;
    if let Ok(key) = v.get_key() {
        for k in keys.iter_mut() {
            let _ = secure_storage::decrypt_sensitive_fields(k, key, &["privateKey"]);
        }
    }

    Ok(keys)
}

#[tauri::command]
async fn save_key(
    name: String,
    private_key_content: String,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<serde_json::Value, String> {
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
    let mut key_obj = serde_json::json!({
        "id": id,
        "name": name,
        "fingerprint": fingerprint,
        "privateKey": private_key_content,
    });

    // Return the unencrypted version to the frontend
    let return_obj = key_obj.clone();

    // Encrypt before saving to disk
    let v = vault.lock().await;
    if let Ok(enc_key) = v.get_key() {
        secure_storage::encrypt_sensitive_fields(&mut key_obj, enc_key, &["privateKey"])?;
    }

    keys.push(key_obj);

    let data = serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(return_obj)
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

// ── Port Forwarding CRUD ────────────────────────────────

#[tauri::command]
async fn list_port_forwarding_rules() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("port_forwarding_rules.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let rules: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(rules)
}

#[tauri::command]
async fn save_port_forwarding_rule(rule: serde_json::Value) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("port_forwarding_rules.json");

    let mut rules: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    let id = rule.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if let Some(pos) = rules.iter().position(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id)) {
        rules[pos] = rule;
    } else {
        rules.push(rule);
    }

    let data = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_port_forwarding_rule(id: String) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("port_forwarding_rules.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut rules: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    rules.retain(|r| {
        if let Some(id_val) = r.get("id") {
            if let Some(id_str) = id_val.as_str() {
                return id_str != id;
            }
        }
        true
    });
    let data = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Snippets CRUD ─────────────────────────────────────

#[tauri::command]
async fn list_snippets() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("snippets.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let snippets: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(snippets)
}

#[tauri::command]
async fn save_snippet(snippet: serde_json::Value) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("snippets.json");

    let mut snippets: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    let id = snippet.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if let Some(pos) = snippets.iter().position(|s| s.get("id").and_then(|v| v.as_str()) == Some(&id)) {
        snippets[pos] = snippet;
    } else {
        snippets.push(snippet);
    }

    let data = serde_json::to_string_pretty(&snippets).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_snippet(id: String) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("snippets.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut snippets: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    snippets.retain(|s| s.get("id").and_then(|v| v.as_str()) != Some(&id));
    let data = serde_json::to_string_pretty(&snippets).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Logs CRUD ─────────────────────────────────────────

#[tauri::command]
async fn list_logs() -> Result<Vec<serde_json::Value>, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("logs.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let logs: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(logs)
}

#[tauri::command]
async fn save_log(log: serde_json::Value, limit: Option<usize>) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("logs.json");

    let mut logs: Vec<serde_json::Value> = if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    // Prepend new log entry
    logs.insert(0, log);

    // Cap at limit (default 500)
    let max = limit.unwrap_or(500);
    logs.truncate(max);

    let data = serde_json::to_string_pretty(&logs).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn clear_logs() -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("logs.json");
    if path.exists() {
        std::fs::write(&path, "[]").map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Settings CRUD ─────────────────────────────────────

#[tauri::command]
async fn get_settings() -> Result<serde_json::Value, String> {
    let storage = ssh_bridge::storage_dir();
    let path = storage.join("settings.json");
    if !path.exists() {
        return Ok(serde_json::json!({
            "logRetentionLimit": 500,
            "logRetentionDays": null
        }));
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let settings: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(settings)
}

#[tauri::command]
async fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();
    std::fs::create_dir_all(&storage).map_err(|e| e.to_string())?;
    let path = storage.join("settings.json");
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Detect Distro ──────────────────────────────────────

#[tauri::command]
async fn detect_distro(
    host_id: String,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<String, String> {
    let storage = ssh_bridge::storage_dir();
    let hosts_path = storage.join("hosts.json");
    let data = std::fs::read_to_string(&hosts_path).map_err(|e| e.to_string())?;
    let mut hosts: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Decrypt sensitive fields for the target host
    let v = vault.lock().await;
    if let Ok(key) = v.get_key() {
        for host in hosts.iter_mut() {
            let _ = secure_storage::decrypt_sensitive_fields(host, key, &["password"]);
        }
    }
    drop(v);

    let host = hosts
        .iter()
        .find(|h| h.get("id").and_then(|v| v.as_str()) == Some(&host_id))
        .ok_or("Host not found")?
        .clone();

    let mut key_content: Option<String> = None;
    if host.get("authMethod").and_then(|v| v.as_str()) == Some("key") {
        if let Some(key_id) = host.get("keyId").and_then(|v| v.as_str()) {
            let keys_path = storage.join("keys.json");
            if keys_path.exists() {
                let kdata = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
                let mut keys: Vec<serde_json::Value> = serde_json::from_str(&kdata).unwrap_or_default();
                // Decrypt private keys
                let v2 = vault.lock().await;
                if let Ok(enc_key) = v2.get_key() {
                    for k in keys.iter_mut() {
                        let _ = secure_storage::decrypt_sensitive_fields(k, enc_key, &["privateKey"]);
                    }
                }
                drop(v2);
                if let Some(key) = keys.iter().find(|k| k.get("id").and_then(|v| v.as_str()) == Some(key_id)) {
                    key_content = key.get("privateKey").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
        }
    }

    let host_json = serde_json::to_string(&host).map_err(|e| e.to_string())?;
    let (python_bin, script) = ssh_bridge::sidecar_paths();

    let mut cmd = std::process::Command::new(python_bin.to_str().unwrap_or("python3"));
    cmd.arg("-u")
        .arg(script.to_str().unwrap_or("sidecar/main.py"))
        .arg("--host-json").arg(&host_json)
        .arg("--session-id").arg("detect")
        .arg("--detect-distro")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .env("PYTHONUNBUFFERED", "1");

    if let Some(ref kc) = key_content {
        cmd.arg("--key-content").arg(kc);
    }

    let output = cmd.output().map_err(|e| format!("Failed to start sidecar: {}", e))?;
    let distro_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(distro_id)
}

// ── Test Connection ────────────────────────────────────

#[tauri::command]
async fn test_connection(
    profile: serde_json::Value,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<String, String> {
    let storage = ssh_bridge::storage_dir();

    // The profile comes from the frontend with decrypted fields already,
    // but we need to decrypt key content from storage
    let mut key_content: Option<String> = None;
    if profile.get("authMethod").and_then(|v| v.as_str()) == Some("key") {
        if let Some(key_id) = profile.get("keyId").and_then(|v| v.as_str()) {
            let keys_path = storage.join("keys.json");
            if keys_path.exists() {
                let kdata = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
                let mut keys: Vec<serde_json::Value> = serde_json::from_str(&kdata).unwrap_or_default();
                let v = vault.lock().await;
                if let Ok(enc_key) = v.get_key() {
                    for k in keys.iter_mut() {
                        let _ = secure_storage::decrypt_sensitive_fields(k, enc_key, &["privateKey"]);
                    }
                }
                drop(v);
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
    no_shell: Option<bool>,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<String, String> {
    let v = vault.lock().await;
    let key = v.get_key().ok();
    let mut bridge = state.lock().await;
    bridge.connect(&host_id, key, no_shell.unwrap_or(false)).await
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

#[tauri::command]
async fn sync_port_forwarding(
    session_id: String,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
) -> Result<(), String> {
    let bridge = state.lock().await;
    bridge.sync_port_forwarding(&session_id).await
}

#[tauri::command]
async fn resize_terminal(
    session_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, Arc<Mutex<SshBridge>>>,
) -> Result<(), String> {
    let bridge = state.lock().await;
    bridge.resize_terminal(&session_id, cols, rows).await
}

// ── SFTP Session Commands ──────────────────────────────

#[tauri::command]
async fn connect_sftp(
    host_id: String,
    state: tauri::State<'_, Arc<Mutex<SftpBridge>>>,
    vault: tauri::State<'_, Arc<Mutex<SecureVault>>>,
) -> Result<String, String> {
    let v = vault.lock().await;
    let key = v.get_key().ok();
    let mut bridge = state.lock().await;
    bridge.connect(&host_id, key).await
}

#[tauri::command]
async fn disconnect_sftp(
    session_id: String,
    state: tauri::State<'_, Arc<Mutex<SftpBridge>>>,
) -> Result<(), String> {
    let mut bridge = state.lock().await;
    bridge.disconnect(&session_id).await
}

#[tauri::command]
async fn sftp_command(
    session_id: String,
    command: String,
    state: tauri::State<'_, Arc<Mutex<SftpBridge>>>,
) -> Result<(), String> {
    let bridge = state.lock().await;
    bridge.send_command(&session_id, &command)
}

// ── Local Filesystem Commands ──────────────────────────

#[tauri::command]
async fn list_local_dir(path: String) -> Result<serde_json::Value, String> {
    let dir_path = std::path::Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let size = metadata.len();
        let is_dir = metadata.is_dir();
        let is_symlink = metadata.file_type().is_symlink();
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        #[cfg(unix)]
        let (permissions, perm_str) = {
            use std::os::unix::fs::PermissionsExt;
            let mode = metadata.permissions().mode();
            let mode_bits = mode & 0o7777;
            (format!("0{:o}", mode_bits), format_unix_permissions(mode))
        };
        #[cfg(not(unix))]
        let (permissions, perm_str) = {
            let ro = metadata.permissions().readonly();
            (
                if ro { "0444".to_string() } else { "0644".to_string() },
                if is_dir {
                    if ro { "dr--r--r--" } else { "drwxr-xr-x" }
                } else {
                    if ro { "-r--r--r--" } else { "-rw-r--r--" }
                }
                .to_string(),
            )
        };

        entries.push(serde_json::json!({
            "name": name,
            "size": size,
            "permissions": permissions,
            "permStr": perm_str,
            "mtime": mtime,
            "isDir": is_dir,
            "isSymlink": is_symlink,
        }));
    }

    Ok(serde_json::json!({
        "path": path,
        "entries": entries,
    }))
}

#[cfg(unix)]
fn format_unix_permissions(mode: u32) -> String {
    let file_type = if mode & 0o40000 != 0 {
        "d"
    } else if mode & 0o120000 == 0o120000 {
        "l"
    } else {
        "-"
    };

    let mut perms = String::with_capacity(10);
    perms.push_str(file_type);

    for shift in (0..3).rev() {
        let bits = (mode >> (shift * 3)) & 0o7;
        perms.push(if bits & 4 != 0 { 'r' } else { '-' });
        perms.push(if bits & 2 != 0 { 'w' } else { '-' });
        perms.push(if bits & 1 != 0 { 'x' } else { '-' });
    }

    perms
}

#[tauri::command]
async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}
