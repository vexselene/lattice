from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List, Any
import os

from app import database, schemas, crud
from app.auth import crypto, session
from app.models.node import AppSetting
from app.models.base import Base

app = FastAPI(title="Lattice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    if not database.is_db_initialized():
        raise HTTPException(status_code=503, detail="Database locked")
    db = next(database.get_db())
    try:
        yield db
    finally:
        db.close()

def get_fernet_key(session_token: str = Header(None)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing session token")
    key = session.session_manager.get_fernet_key(session_token)
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return key

SALT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lattice.salt")

@app.post("/api/auth/setup")
def setup_auth(req: schemas.SetupRequest):
    if os.path.exists(database.get_db_path()):
        raise HTTPException(status_code=400, detail="Already setup")
    
    salt = crypto.generate_salt()
    with open(SALT_PATH, "wb") as f:
        f.write(salt)
        
    db_key = crypto.derive_key(req.master_password, salt)
    
    fernet_key = crypto.generate_fernet_key()
    wrapped_fernet = crypto.wrap_fernet_key(db_key, fernet_key)
    
    database.init_db(db_key.hex())
    
    db = next(database.get_db())
    try:
        db.add(AppSetting(key="wrapped_fernet", value=wrapped_fernet))
        db.add(AppSetting(key="auto_lock_minutes", value="15"))
        db.commit()
    finally:
        db.close()
        
    return {"success": True}

@app.post("/api/auth/unlock")
def unlock_auth(req: schemas.UnlockRequest):
    if not os.path.exists(database.get_db_path()) or not os.path.exists(SALT_PATH):
        raise HTTPException(status_code=400, detail="Not setup")
        
    with open(SALT_PATH, "rb") as f:
        salt = f.read()
        
    db_key = crypto.derive_key(req.master_password, salt)
    
    # Try to initialize DB with the key
    database.init_db(db_key.hex())
    db = next(database.get_db())
    try:
        # Verify by reading wrapped_fernet
        setting = db.query(AppSetting).filter(AppSetting.key == "wrapped_fernet").first()
        if not setting:
            raise HTTPException(status_code=500, detail="Missing wrapped_fernet")
            
        try:
            fernet_key = crypto.unwrap_fernet_key(db_key, setting.value)
        except Exception:
            database.close_db()
            raise HTTPException(status_code=401, detail="Invalid password")
            
        token = session.session_manager.create_session(fernet_key)
        return {"session_token": token, "expires_at": None} # Ignoring expires_at for simplicity
    except Exception as e:
        database.close_db()
        raise HTTPException(status_code=401, detail="Invalid password")
    finally:
        db.close()

@app.post("/api/auth/lock")
def lock_auth(session_token: str = Header(None)):
    if session_token:
        session.session_manager.invalidate_session(session_token)
    database.close_db()
    return {"success": True}

@app.get("/api/auth/status")
def auth_status(session_token: str = Header(None)):
    unlocked = database.is_db_initialized() and (session_token is not None and session.session_manager.is_unlocked(session_token))
    auto_lock_minutes = 15
    if unlocked:
        try:
            db = next(database.get_db())
            setting = db.query(AppSetting).filter(AppSetting.key == "auto_lock_minutes").first()
            if setting:
                auto_lock_minutes = int(setting.value)
            db.close()
        except:
            pass
    return {"unlocked": unlocked, "auto_lock_minutes": auto_lock_minutes}

@app.patch("/api/auth/settings")
def update_settings(req: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    setting = db.query(AppSetting).filter(AppSetting.key == "auto_lock_minutes").first()
    if setting:
        setting.value = str(req.auto_lock_minutes)
    else:
        db.add(AppSetting(key="auto_lock_minutes", value=str(req.auto_lock_minutes)))
    db.commit()
    return {"success": True}

@app.get("/api/nodes/{node_type}")
def get_nodes(node_type: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    if node_type not in crud.NODE_MODELS:
        raise HTTPException(status_code=400, detail="Invalid node type")
    nodes = crud.get_nodes(db, node_type, skip, limit)
    return nodes

@app.get("/api/nodes/{node_type}/{node_id}")
def get_node(node_type: str, node_id: str, db: Session = Depends(get_db)):
    if node_type not in crud.NODE_MODELS:
        raise HTTPException(status_code=400, detail="Invalid node type")
    node = crud.get_node(db, node_type, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@app.post("/api/nodes/{node_type}")
def create_node(node_type: str, req: schemas.NodeCreate, db: Session = Depends(get_db), fernet_key: str = Depends(get_fernet_key)):
    try:
        node = crud.create_node(db, node_type, req.data, fernet_key)
        return node
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/nodes/{node_type}/{node_id}")
def update_node(node_type: str, node_id: str, req: schemas.NodeUpdate, db: Session = Depends(get_db), fernet_key: str = Depends(get_fernet_key)):
    node = crud.update_node(db, node_type, node_id, req.data, fernet_key)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@app.delete("/api/nodes/{node_type}/{node_id}")
def delete_node(node_type: str, node_id: str, db: Session = Depends(get_db)):
    success = crud.delete_node(db, node_type, node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"success": True}

@app.get("/api/nodes/{node_type}/{node_id}/password")
def get_node_password(node_type: str, node_id: str, db: Session = Depends(get_db), fernet_key: str = Depends(get_fernet_key)):
    node = crud.get_node(db, node_type, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if not hasattr(node, "password_encrypted") or not node.password_encrypted:
        return {"password": None}
    password = crypto.decrypt_value(fernet_key, node.password_encrypted)
    return {"password": password}

@app.get("/api/edges")
def get_edges(node_type: Optional[str] = None, node_id: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_edges(db, node_type, node_id)

@app.post("/api/edges")
def create_edge(req: schemas.EdgeCreate, db: Session = Depends(get_db)):
    return crud.create_edge(db, req.model_dump())

@app.put("/api/edges/{edge_id}")
def update_edge(edge_id: str, req: schemas.EdgeUpdate, db: Session = Depends(get_db)):
    edge = crud.update_edge(db, edge_id, req.model_dump(exclude_unset=True))
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@app.delete("/api/edges/{edge_id}")
def delete_edge(edge_id: str, db: Session = Depends(get_db)):
    if not crud.delete_edge(db, edge_id):
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"success": True}

@app.get("/api/graph")
def get_graph(db: Session = Depends(get_db)):
    nodes = []
    for n_type in crud.NODE_MODELS:
        for node in crud.get_nodes(db, n_type):
            nodes.append({"type": n_type, "data": {c.name: getattr(node, c.name) for c in node.__table__.columns}})
    edges = [{"id": e.id, "source_type": e.source_type, "source_id": e.source_id, "target_type": e.target_type, "target_id": e.target_id, "relation": e.relation} for e in crud.get_edges(db)]
    return {"nodes": nodes, "edges": edges}

@app.get("/api/graph/subgraph/{node_type}/{node_id}")
def get_subgraph(node_type: str, node_id: str, depth: int = 1, db: Session = Depends(get_db)):
    # simplified subgraph
    edges = crud.get_edges(db, node_type, node_id)
    return {"edges": [{"id": e.id, "source": e.source_id, "target": e.target_id, "relation": e.relation} for e in edges]}

@app.get("/api/search")
def search(q: str, types: List[str] = Query(None), db: Session = Depends(get_db)):
    results = []
    for n_type in crud.NODE_MODELS:
        if types and n_type not in types:
            continue
        model = crud.NODE_MODELS[n_type]
        # Basic search on available string fields
        query = db.query(model)
        search_filter = []
        for col in model.__table__.columns:
            if str(col.type) == "VARCHAR":
                search_filter.append(col.ilike(f"%{q}%"))
        from sqlalchemy import or_
        if search_filter:
            for node in query.filter(or_(*search_filter)).all():
                results.append({"type": n_type, "data": {c.name: getattr(node, c.name) for c in node.__table__.columns}})
    return {"results": results}

@app.post("/api/utils/generate-password")
def generate_password():
    return {"password": os.urandom(12).hex()}

