import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sqlcipher3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lattice.db")
# Using a global engine/sessionmaker might be tricky since the key is needed.
# We will use a dynamic setup.

_engine = None
_SessionLocal = None

def init_db(db_key: str):
    global _engine, _SessionLocal
    
    # We URL-encode the key to handle special characters, or pass it dynamically
    # For a hex key, we can just use PRAGMA key="x'HEX'"
    # But pysqlcipher dialect supports ?key=... in the URL.
    encoded_key = urllib.parse.quote_plus(db_key)
    # The password goes in the auth part of the URL: sqlite+pysqlcipher://:password@/path
    db_url = f"sqlite+pysqlcipher://:{encoded_key}@/{DB_PATH}"
    
    _engine = create_engine(db_url, module=sqlcipher3)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    
    from app.models.base import Base
    Base.metadata.create_all(bind=_engine)

def get_db():
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()

def close_db():
    global _engine, _SessionLocal
    if _engine:
        _engine.dispose()
    _engine = None
    _SessionLocal = None

def is_db_initialized():
    return _engine is not None

def get_db_path():
    return DB_PATH
