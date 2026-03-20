//! Secure storage layer for SwiftSSH.
//!
//! Manages the encrypted vault state: master password verification,
//! field-level encryption/decryption of JSON data, and data migration.

use crate::crypto;
use crate::ssh_bridge;
use serde_json::Value;
use std::path::PathBuf;

const ENCRYPTED_PREFIX: &str = "enc:";

/// Vault metadata stored in `vault.meta.json`.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct VaultMeta {
    pub salt: String,        // base64-encoded salt
    pub verify_hash: String, // password verification hash
}

/// In-memory vault state holding the derived encryption key.
pub struct SecureVault {
    key: Option<[u8; 32]>,
}

impl SecureVault {
    pub fn new() -> Self {
        Self { key: None }
    }

    /// Check if the vault has been initialized (master password set).
    pub fn is_initialized() -> bool {
        meta_path().exists()
    }

    /// Check if the vault is currently unlocked.
    pub fn is_unlocked(&self) -> bool {
        self.key.is_some()
    }

    /// Get the encryption key (panics if locked — callers should check first).
    pub fn get_key(&self) -> Result<&[u8; 32], String> {
        self.key.as_ref().ok_or_else(|| "Vault is locked".to_string())
    }

    /// Initialize the vault with a new master password.
    /// Creates the salt and verification hash, then runs data migration.
    pub fn init(&mut self, password: &str) -> Result<(), String> {
        if Self::is_initialized() {
            return Err("Vault is already initialized".to_string());
        }

        let salt = crypto::generate_salt();
        let key = crypto::derive_key(password, &salt)?;
        let verify_hash = crypto::create_verify_hash(password, &salt)?;

        let meta = VaultMeta {
            salt: base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                salt,
            ),
            verify_hash,
        };

        let meta_json = serde_json::to_string_pretty(&meta)
            .map_err(|e| format!("Failed to serialize vault meta: {}", e))?;

        let path = meta_path();
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        std::fs::write(&path, meta_json).map_err(|e| e.to_string())?;

        // Migrate existing plaintext data
        migrate_plaintext_to_encrypted(&key)?;

        self.key = Some(key);
        Ok(())
    }

    /// Unlock the vault with the master password.
    /// If plaintext data exists (pre-encryption), migrates it automatically.
    pub fn unlock(&mut self, password: &str) -> Result<(), String> {
        let meta = load_meta()?;
        let salt = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &meta.salt,
        )
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

        if !crypto::verify_password(password, &salt, &meta.verify_hash)? {
            return Err("Incorrect password".to_string());
        }

        let key = crypto::derive_key(password, &salt)?;

        // Check for any remaining plaintext data and migrate
        migrate_plaintext_to_encrypted(&key)?;

        self.key = Some(key);
        Ok(())
    }

    /// Lock the vault — clear the key from memory.
    pub fn lock(&mut self) {
        if let Some(ref mut key) = self.key {
            // Zero out the key before dropping
            for byte in key.iter_mut() {
                *byte = 0;
            }
        }
        self.key = None;
    }

    /// Change the master password and re-encrypt all sensitive data.
    pub fn change_password(&mut self, old_password: &str, new_password: &str) -> Result<(), String> {
        let meta = load_meta()?;
        let salt = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &meta.salt,
        )
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

        if !crypto::verify_password(old_password, &salt, &meta.verify_hash)? {
            return Err("Incorrect old password".to_string());
        }

        let old_key = crypto::derive_key(old_password, &salt)?;
        let storage = ssh_bridge::storage_dir();

        // 1. Decrypt all sensitive data with old key
        
        // Hosts
        let hosts_path = storage.join("hosts.json");
        let mut hosts: Vec<Value> = if hosts_path.exists() {
            let data = std::fs::read_to_string(&hosts_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            vec![]
        };
        for host in hosts.iter_mut() {
            let _ = decrypt_sensitive_fields(host, &old_key, &["password"]);
        }

        // Keys
        let keys_path = storage.join("keys.json");
        let mut keys: Vec<Value> = if keys_path.exists() {
            let data = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            vec![]
        };
        for key_entry in keys.iter_mut() {
            let _ = decrypt_sensitive_fields(key_entry, &old_key, &["privateKey"]);
        }

        // 2. Setup new key
        let new_salt = crypto::generate_salt();
        let new_key = crypto::derive_key(new_password, &new_salt)?;
        let new_verify_hash = crypto::create_verify_hash(new_password, &new_salt)?;

        // 3. Re-encrypt with new key
        for host in hosts.iter_mut() {
            encrypt_sensitive_fields(host, &new_key, &["password"])?;
        }
        for key_entry in keys.iter_mut() {
            encrypt_sensitive_fields(key_entry, &new_key, &["privateKey"])?;
        }

        // 4. Save everything
        let new_meta = VaultMeta {
            salt: base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                new_salt,
            ),
            verify_hash: new_verify_hash,
        };
        
        let meta_json = serde_json::to_string_pretty(&new_meta)
            .map_err(|e| format!("Failed to serialize new vault meta: {}", e))?;
        std::fs::write(meta_path(), meta_json).map_err(|e| e.to_string())?;

        let hosts_json = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
        std::fs::write(&hosts_path, hosts_json).map_err(|e| e.to_string())?;

        let keys_json = serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?;
        std::fs::write(&keys_path, keys_json).map_err(|e| e.to_string())?;

        self.key = Some(new_key);
        Ok(())
    }
}

// ── Path helpers ──────────────────────────────────────────

fn meta_path() -> PathBuf {
    ssh_bridge::storage_dir().join("vault.meta.json")
}

fn load_meta() -> Result<VaultMeta, String> {
    let path = meta_path();
    if !path.exists() {
        return Err("Vault not initialized".to_string());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse vault meta: {}", e))
}

// ── Field-level encryption helpers ────────────────────────

/// Encrypt specified fields in a JSON value in-place.
/// Only encrypts non-empty string fields that aren't already encrypted.
pub fn encrypt_sensitive_fields(json: &mut Value, key: &[u8; 32], fields: &[&str]) -> Result<(), String> {
    if let Some(obj) = json.as_object_mut() {
        for &field in fields {
            if let Some(Value::String(val)) = obj.get(field) {
                if !val.is_empty() && !val.starts_with(ENCRYPTED_PREFIX) {
                    let encrypted = crypto::encrypt(val, key)?;
                    let tagged = format!("{}{}", ENCRYPTED_PREFIX, encrypted);
                    obj.insert(field.to_string(), Value::String(tagged));
                }
            }
        }
    }
    Ok(())
}

/// Decrypt specified fields in a JSON value in-place.
/// Only decrypts fields that have the encrypted prefix.
pub fn decrypt_sensitive_fields(json: &mut Value, key: &[u8; 32], fields: &[&str]) -> Result<(), String> {
    if let Some(obj) = json.as_object_mut() {
        for &field in fields {
            if let Some(Value::String(val)) = obj.get(field) {
                if let Some(ciphertext) = val.strip_prefix(ENCRYPTED_PREFIX) {
                    let decrypted = crypto::decrypt(ciphertext, key)?;
                    obj.insert(field.to_string(), Value::String(decrypted));
                }
            }
        }
    }
    Ok(())
}

// ── Data migration ────────────────────────────────────────

/// Migrate plaintext sensitive fields to encrypted.
/// Detects whether fields are already encrypted by checking the prefix.
fn migrate_plaintext_to_encrypted(key: &[u8; 32]) -> Result<(), String> {
    let storage = ssh_bridge::storage_dir();

    // Migrate hosts.json — encrypt password fields
    let hosts_path = storage.join("hosts.json");
    if hosts_path.exists() {
        let data = std::fs::read_to_string(&hosts_path).map_err(|e| e.to_string())?;
        let mut hosts: Vec<Value> = serde_json::from_str(&data).unwrap_or_default();
        let mut changed = false;

        for host in hosts.iter_mut() {
            if let Some(Value::String(pw)) = host.get("password") {
                if !pw.is_empty() && !pw.starts_with(ENCRYPTED_PREFIX) {
                    encrypt_sensitive_fields(host, key, &["password"])?;
                    changed = true;
                }
            }
        }

        if changed {
            let data = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
            std::fs::write(&hosts_path, data).map_err(|e| e.to_string())?;
            eprintln!("[secure_storage] Migrated hosts.json passwords to encrypted");
        }
    }

    // Migrate keys.json — encrypt privateKey fields
    let keys_path = storage.join("keys.json");
    if keys_path.exists() {
        let data = std::fs::read_to_string(&keys_path).map_err(|e| e.to_string())?;
        let mut keys: Vec<Value> = serde_json::from_str(&data).unwrap_or_default();
        let mut changed = false;

        for key_entry in keys.iter_mut() {
            if let Some(Value::String(pk)) = key_entry.get("privateKey") {
                if !pk.is_empty() && !pk.starts_with(ENCRYPTED_PREFIX) {
                    encrypt_sensitive_fields(key_entry, key, &["privateKey"])?;
                    changed = true;
                }
            }
        }

        if changed {
            let data = serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?;
            std::fs::write(&keys_path, data).map_err(|e| e.to_string())?;
            eprintln!("[secure_storage] Migrated keys.json privateKeys to encrypted");
        }
    }

    Ok(())
}
