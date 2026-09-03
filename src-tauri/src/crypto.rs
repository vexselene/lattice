//! Cryptographic primitives for Lattice: Argon2id KDF and AES-256-GCM encryption.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{rngs::OsRng, RngCore};
use zeroize::Zeroizing;

pub const SALT_SIZE: usize = 16;
pub const KEY_SIZE: usize = 32;
pub const NONCE_SIZE: usize = 12;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CryptoError {
    #[error("Authentication failed: invalid key or corrupted data")]
    AuthenticationFailed,

    #[error("Malformed ciphertext: {0}")]
    MalformedCiphertext(String),

    #[error("Salt length mismatch: expected {expected}, got {actual}")]
    SaltLengthMismatch { expected: usize, actual: usize },

    #[error("Nonce length mismatch: expected {expected}, got {actual}")]
    NonceLengthMismatch { expected: usize, actual: usize },

    #[error("Key derivation failed: {0}")]
    KeyDerivation(String),

    #[error("UTF-8 decoding failed: {0}")]
    Utf8(String),
}

/// Derives a 32-byte master encryption key from a password and salt using Argon2id.
///
/// Parameters:
/// - Memory cost: 65,536 KB (64 MB)
/// - Time cost: 3 iterations
/// - Parallelism: 4 lanes
/// - Output: 32 bytes wrapped in `Zeroizing`
pub fn derive_master_key(password: &str, salt: &[u8; 16]) -> Zeroizing<[u8; 32]> {
    let params = Params::new(65536, 3, 4, Some(KEY_SIZE))
        .expect("valid Argon2id parameters");
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_SIZE];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .expect("key derivation into 32-byte buffer");

    Zeroizing::new(key)
}

/// Generates a cryptographically secure random 16-byte salt via `OsRng`.
pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generates a cryptographically secure random 12-byte nonce for AES-256-GCM.
fn generate_nonce() -> [u8; NONCE_SIZE] {
    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Encrypts a plaintext string using AES-256-GCM.
///
/// Generates a fresh random 96-bit nonce per call, prepends the nonce
/// to the ciphertext + tag, and returns a standard Base64-encoded string.
pub fn encrypt_field(plaintext: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    let cipher_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(cipher_key);

    let nonce_bytes = generate_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::AuthenticationFailed)?;

    // Prepend 12-byte nonce to ciphertext (which includes 16-byte auth tag)
    let mut payload = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(&payload))
}

/// Decrypts a Base64-encoded payload produced by `encrypt_field`.
///
/// Extracts the 12-byte nonce and verifies/decrypts the ciphertext using AES-256-GCM.
pub fn decrypt_field(ciphertext_b64: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    let payload = STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| CryptoError::MalformedCiphertext(e.to_string()))?;

    // Must have at least NONCE_SIZE (12) + TAG_SIZE (16) = 28 bytes
    if payload.len() < NONCE_SIZE + 16 {
        return Err(CryptoError::MalformedCiphertext(format!(
            "Payload too short: expected at least {} bytes, got {}",
            NONCE_SIZE + 16,
            payload.len()
        )));
    }

    let (nonce_bytes, ciphertext) = payload.split_at(NONCE_SIZE);
    let cipher_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(cipher_key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::AuthenticationFailed)?;

    String::from_utf8(decrypted).map_err(|e| CryptoError::Utf8(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_roundtrip() {
        let test_data = b"Hello Lattice Cryptography Testing 123!@#";
        let encoded = STANDARD.encode(test_data);
        let decoded = STANDARD.decode(&encoded).expect("base64 decode");
        assert_eq!(decoded, test_data);
    }

    #[test]
    fn test_derive_master_key() {
        let salt = generate_salt();
        let key1 = derive_master_key("correct horse battery staple", &salt);
        let key2 = derive_master_key("correct horse battery staple", &salt);
        assert_eq!(*key1, *key2);

        let key_diff = derive_master_key("wrong password", &salt);
        assert_ne!(*key1, *key_diff);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let salt = generate_salt();
        let key = derive_master_key("master-password-test", &salt);

        let plaintext = "super_secret_password_12345!";
        let ciphertext = encrypt_field(plaintext, &key).expect("encrypt succeeds");
        assert_ne!(ciphertext, plaintext);

        let decrypted = decrypt_field(&ciphertext, &key).expect("decrypt succeeds");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        let salt = generate_salt();
        let key1 = derive_master_key("password-one", &salt);
        let key2 = derive_master_key("password-two", &salt);

        let ciphertext = encrypt_field("sensitive data", &key1).unwrap();
        let result = decrypt_field(&ciphertext, &key2);

        assert_eq!(result, Err(CryptoError::AuthenticationFailed));
    }

    #[test]
    fn test_decrypt_malformed_ciphertext() {
        let salt = generate_salt();
        let key = derive_master_key("password", &salt);

        // Invalid base64
        let res1 = decrypt_field("not-valid-base64!", &key);
        assert!(matches!(res1, Err(CryptoError::MalformedCiphertext(_))));

        // Too short (valid base64 but shorter than 28 bytes)
        let res2 = decrypt_field("AAAA", &key);
        assert!(matches!(res2, Err(CryptoError::MalformedCiphertext(_))));
    }

    #[test]
    fn test_fresh_nonce_per_encryption() {
        let salt = generate_salt();
        let key = derive_master_key("test", &salt);

        let ct1 = encrypt_field("identical plaintext", &key).unwrap();
        let ct2 = encrypt_field("identical plaintext", &key).unwrap();

        // Different nonces must produce different ciphertexts
        assert_ne!(ct1, ct2);

        // Both decrypt to the same plaintext
        assert_eq!(decrypt_field(&ct1, &key).unwrap(), "identical plaintext");
        assert_eq!(decrypt_field(&ct2, &key).unwrap(), "identical plaintext");
    }
}
