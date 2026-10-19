"""Persistent local extension approvals; no session credentials."""
import sqlalchemy as sa
from alembic import op

revision = "f144_connections"
down_revision = "6bbbdad71a37"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("extension_connections",
        sa.Column("extension_id", sa.String(32), primary_key=True),
        sa.Column("owner_id", sa.String(100), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)))


def downgrade():
    # Dropping revocations could re-enable configured IDs; never discard them silently.
    if op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM extension_connections")):
        raise RuntimeError("Preserve extension approvals/revocations; populated downgrade refused")
    op.drop_table("extension_connections")
