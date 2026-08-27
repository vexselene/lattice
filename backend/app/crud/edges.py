from sqlalchemy.orm import Session
from app.models.edge import Edge

def get_edge(db: Session, edge_id: str):
    return db.query(Edge).filter(Edge.id == edge_id).first()

def get_edges(db: Session, node_type: str = None, node_id: str = None):
    query = db.query(Edge)
    if node_type and node_id:
        query = query.filter(
            ((Edge.source_type == node_type) & (Edge.source_id == node_id)) |
            ((Edge.target_type == node_type) & (Edge.target_id == node_id))
        )
    return query.all()

def create_edge(db: Session, data: dict):
    db_edge = Edge(**data)
    db.add(db_edge)
    db.commit()
    db.refresh(db_edge)
    return db_edge

def update_edge(db: Session, edge_id: str, data: dict):
    db_edge = get_edge(db, edge_id)
    if not db_edge:
        return None
    for key, value in data.items():
        setattr(db_edge, key, value)
    db.commit()
    db.refresh(db_edge)
    return db_edge

def delete_edge(db: Session, edge_id: str):
    db_edge = get_edge(db, edge_id)
    if not db_edge:
        return False
    db.delete(db_edge)
    db.commit()
    return True
