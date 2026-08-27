import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.node import EmailNode, PhoneNode, ServiceNode, AccountNode
from app.models.edge import Edge
from app.auth.crypto import encrypt_value, decrypt_value

NODE_MODELS = {
    "email": EmailNode,
    "phone": PhoneNode,
    "service": ServiceNode,
    "account": AccountNode
}

def get_node(db: Session, node_type: str, node_id: str):
    model = NODE_MODELS.get(node_type)
    if not model:
        return None
    return db.query(model).filter(model.id == node_id).first()

def get_nodes(db: Session, node_type: str, skip: int = 0, limit: int = 100):
    model = NODE_MODELS.get(node_type)
    if not model:
        return []
    return db.query(model).offset(skip).limit(limit).all()

def create_node(db: Session, node_type: str, data: dict, fernet_key: str):
    model = NODE_MODELS.get(node_type)
    if not model:
        raise ValueError(f"Unknown node type {node_type}")
    
    raw_password = data.pop("password_raw", None) or data.pop("password", None)
    if raw_password and fernet_key:
        data["password_encrypted"] = encrypt_value(fernet_key, raw_password)
        
    data.pop("id", None)
    data.pop("isEditing", None)
    data.pop("isExpanded", None)
    data.pop("isDraft", None)
        
    db_node = model(**data)
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

def update_node(db: Session, node_type: str, node_id: str, data: dict, fernet_key: str):
    db_node = get_node(db, node_type, node_id)
    if not db_node:
        return None
        
    raw_password = data.pop("password_raw", None) or data.pop("password", None)
    if raw_password and fernet_key:
        data["password_encrypted"] = encrypt_value(fernet_key, raw_password)
        
    data.pop("created_at", None)
    data.pop("updated_at", None)
    data.pop("id", None)
    data.pop("isEditing", None)
    data.pop("isExpanded", None)
    data.pop("isDraft", None)
        
    for key, value in data.items():
        setattr(db_node, key, value)
        
    db_node.updated_at = datetime.datetime.now(datetime.timezone.utc)
        
    db.commit()
    db.refresh(db_node)
    return db_node

def delete_node(db: Session, node_type: str, node_id: str):
    db_node = get_node(db, node_type, node_id)
    if not db_node:
        return False
        
    # Clean up polymorphic orphaned edges
    db.query(Edge).filter(
        or_(
            and_(Edge.source_type == node_type, Edge.source_id == node_id),
            and_(Edge.target_type == node_type, Edge.target_id == node_id)
        )
    ).delete(synchronize_session=False)
    
    db.delete(db_node)
    db.commit()
    return True
