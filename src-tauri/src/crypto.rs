//! Cryptographic primitives for SwiftSSH encrypted storage.
//!
//! Uses AES-256-GCM for encryption and Argon2id for key derivation.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{self, Algorithm, Argon2, Params, Version};
use base64::Engine;
use rand::RngCore;

const NONCE_LEN: usize = 12;
const SALT_LEN: usize = 16;

/// Generate a random 16-byte salt.
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

/// Derive a 32-byte encryption key from a password and salt using Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let params = Params::new(
        19_456, // 19 MiB memory cost
        2,      // 2 iterations
        1,      // 1 degree of parallelism
        Some(32),
    )
    .map_err(|e| format!("Argon2 params error: {}", e))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Argon2 hash error: {}", e))?;

    Ok(key)
}

/// Encrypt plaintext with AES-256-GCM.
///
/// Returns a base64-encoded string of `nonce || ciphertext_with_tag`.
pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES key error: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    // Concatenate nonce || ciphertext (which includes the GCM tag)
    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(base64::engine::general_purpose::STANDARD.encode(&combined))
}

/// Decrypt a base64-encoded `nonce || ciphertext_with_tag` string.
pub fn decrypt(ciphertext_b64: &str, key: &[u8; 32]) -> Result<String, String> {
    let combined = base64::engine::general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    if combined.len() < NONCE_LEN + 16 {
        return Err("Ciphertext too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES key error: {}", e))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed (wrong password or corrupted data)".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode error: {}", e))
}

/// Create a verification hash that can be stored to check if a password is correct
/// without storing the password itself. Uses a separate Argon2id derivation.
pub fn create_verify_hash(password: &str, salt: &[u8]) -> Result<String, String> {
    let mut verify_key = [0u8; 32];
    // Use different params to produce a different output from the encryption key
    let params =
        Params::new(19_456, 2, 1, Some(32)).map_err(|e| format!("Argon2 params error: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // Use a derived salt (original salt XOR'd with a constant) so the verify hash
    // is different from the encryption key even with same password
    let mut verify_salt = salt.to_vec();
    for byte in verify_salt.iter_mut() {
        *byte ^= 0xAA;
    }

    argon2
        .hash_password_into(password.as_bytes(), &verify_salt, &mut verify_key)
        .map_err(|e| format!("Argon2 verify hash error: {}", e))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(verify_key))
}

/// Check if a password matches the stored verification hash.
pub fn verify_password(password: &str, salt: &[u8], stored_hash: &str) -> Result<bool, String> {
    let computed = create_verify_hash(password, salt)?;
    Ok(computed == stored_hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [42u8; 32];
        let plaintext = "my-secret-password-123!";
        let encrypted = encrypt(plaintext, &key).unwrap();
        assert_ne!(encrypted, plaintext);
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = [42u8; 32];
        let key2 = [99u8; 32];
        let encrypted = encrypt("secret", &key1).unwrap();
        assert!(decrypt(&encrypted, &key2).is_err());
    }

    #[test]
    fn test_key_derivation() {
        let salt = generate_salt();
        let key1 = derive_key("password", &salt).unwrap();
        let key2 = derive_key("password", &salt).unwrap();
        assert_eq!(key1, key2); // Deterministic

        let key3 = derive_key("different", &salt).unwrap();
        assert_ne!(key1, key3); // Different password → different key
    }

    #[test]
    fn test_verify_password() {
        let salt = generate_salt();
        let hash = create_verify_hash("mypassword", &salt).unwrap();
        assert!(verify_password("mypassword", &salt, &hash).unwrap());
        assert!(!verify_password("wrongpassword", &salt, &hash).unwrap());
    }
}
