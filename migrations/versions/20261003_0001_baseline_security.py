"""Baseline existing schema and add moderation/event ownership.

Revision ID: 20261003_0001
Revises: None
"""
from alembic import op
import sqlalchemy as sa

from backend.core.database import Base
from backend import models  # noqa: F401

revision = "20261003_0001"
down_revision = None
branch_labels = None
depends_on = None


def _columns(inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    # Creates the complete schema for a fresh managed database while preserving
    # installations that already have the legacy tables.
    Base.metadata.create_all(bind=bind)
    inspector = sa.inspect(bind)

    if "created_by_id" not in _columns(inspector, "events"):
        with op.batch_alter_table("events") as batch:
            batch.add_column(sa.Column("created_by_id", sa.Integer(), nullable=True))
            batch.create_foreign_key("fk_events_created_by", "students", ["created_by_id"], ["id"])
            batch.create_index("ix_events_created_by_id", ["created_by_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("anonymous_post_reports"):
        op.drop_table("anonymous_post_reports")
    if inspector.has_table("events") and "created_by_id" in _columns(inspector, "events"):
        owner_fkey = next(
            (
                foreign_key
                for foreign_key in inspector.get_foreign_keys("events")
                if foreign_key.get("constrained_columns") == ["created_by_id"]
            ),
            None,
        )
        with op.batch_alter_table("events") as batch:
            if owner_fkey and owner_fkey.get("name"):
                batch.drop_constraint(owner_fkey["name"], type_="foreignkey")
            batch.drop_index("ix_events_created_by_id")
            batch.drop_column("created_by_id")
