"""Add private append-only execution envelopes; no public contract change."""

import sqlalchemy as sa
from alembic import op

revision = "6bbbdad71a37"
down_revision = "de913d28ee1a"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != "sqlite":
        raise RuntimeError("Private execution-envelope migration supports SQLite only")
    op.create_table(
        "execution_envelopes",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("execution_id", sa.String(100), nullable=False),
        sa.Column("raw_transaction", sa.LargeBinary(), nullable=False),
        sa.Column("transaction_hash", sa.String(66), nullable=False),
        sa.ForeignKeyConstraint(["execution_id"], ["executions.id"]),
        sa.UniqueConstraint("execution_id"),
        sa.UniqueConstraint("transaction_hash"),
        sa.CheckConstraint(
            "typeof(raw_transaction) = 'blob' AND length(raw_transaction) BETWEEN 1 AND 4096",
            name="ck_envelope_byte_bound",
        ),
        sa.CheckConstraint(
            "length(transaction_hash) = 66 AND substr(transaction_hash, 1, 2) = '0x' "
            "AND substr(transaction_hash, 3) NOT GLOB '*[^0-9a-f]*'",
            name="ck_envelope_hash_shape",
        ),
    )
    # A normal application writer cannot replace recoverable bytes after signing.
    # A compromised DBA can still drop triggers; this is not admin-proof storage.
    for operation in ("UPDATE", "DELETE"):
        op.execute(
            f"CREATE TRIGGER execution_envelopes_no_{operation.lower()} "
            f"BEFORE {operation} ON execution_envelopes BEGIN "
            "SELECT RAISE(ABORT, 'Execution envelope is immutable'); END"
        )
    # SQLite REPLACE can delete a conflicting row without firing DELETE triggers
    # when recursive_triggers is off. Refuse collisions before conflict handling.
    op.execute(
        "CREATE TRIGGER execution_envelopes_no_replace BEFORE INSERT ON execution_envelopes "
        "WHEN EXISTS (SELECT 1 FROM execution_envelopes WHERE id = NEW.id "
        "OR execution_id = NEW.execution_id OR transaction_hash = NEW.transaction_hash) "
        "BEGIN SELECT RAISE(ABORT, 'Execution envelope already exists'); END"
    )


def downgrade():
    connection = op.get_bind()
    # Serialize the empty check and DDL against an application journal insertion.
    connection.exec_driver_sql("BEGIN IMMEDIATE")
    if connection.scalar(sa.text("SELECT COUNT(*) FROM execution_envelopes")):
        raise RuntimeError(
            "Cannot downgrade a non-empty execution journal; preserve signed envelopes"
        )
    op.execute("DROP TRIGGER execution_envelopes_no_replace")
    op.execute("DROP TRIGGER execution_envelopes_no_update")
    op.execute("DROP TRIGGER execution_envelopes_no_delete")
    op.drop_table("execution_envelopes")
