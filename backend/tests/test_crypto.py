import pytest
from app.auth import crypto

def test_derive_key():
    password = "supersecretpassword"
    salt = crypto.generate_salt()
    key = crypto.derive_key(password, salt)
    assert len(key) == 32
    
    key2 = crypto.derive_key(password, salt)
    assert key == key2

def test_fernet_encryption():
    password = "supersecretpassword"
    salt = crypto.generate_salt()
    db_key = crypto.derive_key(password, salt)
    
    fernet_key = crypto.generate_fernet_key()
    wrapped = crypto.wrap_fernet_key(db_key, fernet_key)
    
    assert wrapped != fernet_key
    
    unwrapped = crypto.unwrap_fernet_key(db_key, wrapped)
    assert unwrapped == fernet_key

def test_value_encryption():
    fernet_key = crypto.generate_fernet_key()
    original_value = "my_secret_data"
    
    encrypted = crypto.encrypt_value(fernet_key, original_value)
    assert encrypted != original_value
    
    decrypted = crypto.decrypt_value(fernet_key, encrypted)
    assert decrypted == original_value

def test_encrypt_empty_value():
    fernet_key = crypto.generate_fernet_key()
    assert crypto.encrypt_value(fernet_key, "") == ""
    assert crypto.encrypt_value(fernet_key, None) == None
    
    assert crypto.decrypt_value(fernet_key, "") == ""
    assert crypto.decrypt_value(fernet_key, None) == None
