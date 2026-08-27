import datetime
import uuid
from sqlalchemy import String, DateTime, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    target_type: Mapped[str] = mapped_column(String, nullable=False)
    target_id: Mapped[str] = mapped_column(String, nullable=False)
    relation: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC), nullable=False
    )

    __table_args__ = (
        CheckConstraint("source_type IN ('email','account','service','phone')", name="ck_source_type"),
        CheckConstraint("target_type IN ('email','account','service','phone')", name="ck_target_type"),
        CheckConstraint("relation IN ('registered_with','recovery_for','uses_username','linked_account')", name="ck_relation"),
        Index("idx_edges_source", "source_type", "source_id"),
        Index("idx_edges_target", "target_type", "target_id"),
        Index("idx_edges_relation", "relation"),
    )
