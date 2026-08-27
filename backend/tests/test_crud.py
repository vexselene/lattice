import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sqlcipher3
from app.models.base import Base
from app.crud import nodes, edges
from app.auth import crypto

@pytest.fixture(scope="module")
def db_session():
    # Use in-memory sqlcipher db
    engine = create_engine("sqlite+pysqlcipher://:testkey@/:memory:", module=sqlcipher3)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()

@pytest.fixture
def fernet_key():
    return crypto.generate_fernet_key()

def test_create_and_get_email(db_session, fernet_key):
    email_data = {
        "address": "test@example.com",
        "provider": "google",
        "password": "email_password"
    }
    
    node = nodes.create_node(db_session, "email", email_data, fernet_key)
    assert node.id is not None
    assert node.address == "test@example.com"
    assert node.password_encrypted is not None
    assert node.password_encrypted != "email_password"
    
    fetched = nodes.get_node(db_session, "email", node.id)
    assert fetched.id == node.id
    
    all_emails = nodes.get_nodes(db_session, "email")
    assert len(all_emails) > 0

def test_create_and_update_service(db_session, fernet_key):
    service_data = {
        "name": "GitHub",
        "url": "https://github.com"
    }
    node = nodes.create_node(db_session, "service", service_data, fernet_key)
    
    updated = nodes.update_node(db_session, "service", node.id, {"category": "dev"}, fernet_key)
    assert updated.category == "dev"

def test_create_account(db_session, fernet_key):
    # Need service first
    service = nodes.create_node(db_session, "service", {"name": "TestService"}, fernet_key)
    
    account_data = {
        "username": "user123",
        "password": "account_password",
        "service_id": service.id
    }
    acc = nodes.create_node(db_session, "account", account_data, fernet_key)
    assert acc.username == "user123"

def test_edges_and_orphaned_cleanup(db_session, fernet_key):
    email1 = nodes.create_node(db_session, "email", {"address": "e1@test.com"}, fernet_key)
    email2 = nodes.create_node(db_session, "email", {"address": "e2@test.com"}, fernet_key)
    
    edge_data = {
        "source_type": "email",
        "source_id": email1.id,
        "target_type": "email",
        "target_id": email2.id,
        "relation": "recovery_for"
    }
    
    edge = edges.create_edge(db_session, edge_data)
    assert edge.id is not None
    
    edges_list = edges.get_edges(db_session, "email", email1.id)
    assert len(edges_list) == 1
    
    # Delete email1, should cascade delete edge via the custom polymorphic cleanup
    nodes.delete_node(db_session, "email", email1.id)
    
    edges_list_after = edges.get_edges(db_session, "email", email1.id)
    assert len(edges_list_after) == 0
