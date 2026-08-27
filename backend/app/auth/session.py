import uuid
from typing import Optional, Dict

class SessionManager:
    def __init__(self):
        # Maps session_token -> fernet_key
        self._sessions: Dict[str, str] = {}
        # We also need a way to track the active DB engine/session if needed,
        # but for now we just track the fernet key since SQLCipher manages its own connections via the URL.

    def create_session(self, fernet_key: str) -> str:
        token = str(uuid.uuid4())
        self._sessions[token] = fernet_key
        return token

    def get_fernet_key(self, token: str) -> Optional[str]:
        return self._sessions.get(token)

    def invalidate_session(self, token: str):
        if token in self._sessions:
            del self._sessions[token]

    def is_unlocked(self, token: str) -> bool:
        return token in self._sessions

# Global singleton
session_manager = SessionManager()
