import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# Constants for Argon2id
SALT_SIZE = 16
KEY_LENGTH = 32

def derive_key(password: str, salt: bytes) -> bytes:
    """Derives a 32-byte key from the password and salt using Argon2id."""
    kdf = Argon2id(
        salt=salt,
        length=KEY_LENGTH,
        iterations=3,
        lanes=4,
        memory_cost=65536,
    )
    return kdf.derive(password.encode('utf-8'))

def generate_salt() -> bytes:
    return os.urandom(SALT_SIZE)

def generate_fernet_key() -> str:
    """Generates a new Fernet key."""
    return Fernet.generate_key().decode('utf-8')

def wrap_fernet_key(master_key_bytes: bytes, fernet_key: str) -> str:
    """Encrypts the Fernet key using the derived master key."""
    # Convert master key to valid Fernet key (urlsafe base64)
    wrapping_key = base64.urlsafe_b64encode(master_key_bytes)
    f = Fernet(wrapping_key)
    return f.encrypt(fernet_key.encode('utf-8')).decode('utf-8')

def unwrap_fernet_key(master_key_bytes: bytes, wrapped_fernet_key: str) -> str:
    """Decrypts the wrapped Fernet key using the derived master key."""
    wrapping_key = base64.urlsafe_b64encode(master_key_bytes)
    f = Fernet(wrapping_key)
    return f.decrypt(wrapped_fernet_key.encode('utf-8')).decode('utf-8')

def encrypt_value(fernet_key: str, value: str) -> str:
    if not value:
        return value
    f = Fernet(fernet_key.encode('utf-8'))
    return f.encrypt(value.encode('utf-8')).decode('utf-8')

def decrypt_value(fernet_key: str, encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    f = Fernet(fernet_key.encode('utf-8'))
    return f.decrypt(encrypted_value.encode('utf-8')).decode('utf-8')
