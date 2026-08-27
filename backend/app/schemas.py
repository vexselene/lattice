from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SetupRequest(BaseModel):
    master_password: str

class UnlockRequest(BaseModel):
    master_password: str

class SettingsUpdate(BaseModel):
    auto_lock_minutes: int

class NodeCreate(BaseModel):
    # Depending on the node type, we accept a flexible dict for now
    data: Dict[str, Any]

class NodeUpdate(BaseModel):
    data: Dict[str, Any]

class EdgeCreate(BaseModel):
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    relation: str
    notes: Optional[str] = None

class EdgeUpdate(BaseModel):
    relation: Optional[str] = None
    notes: Optional[str] = None
