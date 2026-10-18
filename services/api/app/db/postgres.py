"""PF-046 approved private storage contract, consumed by PF-047 runtime adapters."""

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

PRIVATE_SCHEMA = "prooffi_private"
# Single-user authority/audit serialization, shared by every future PG consumer.
# Transaction scoped: releases on commit, rollback, disconnect and backend crash.
AUTHORITY_LOCK = 0x50524F4F464649


def make_postgres_engine(url: str):
    parsed = make_url(url)
    if parsed.drivername != "postgresql+psycopg":
        raise ValueError("PostgreSQL requires the psycopg driver")
    if parsed.port == 6543:
        raise ValueError("Use a direct or session-mode connection, not transaction pooling")
    if (
        parsed.host not in ("127.0.0.1", "::1", "localhost")
        and parsed.query.get("sslmode") != "verify-full"
    ):
        raise ValueError("Remote PostgreSQL requires sslmode=verify-full and trusted CA")
    engine = create_engine(
        parsed,
        isolation_level="READ COMMITTED",
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
        hide_parameters=True,
        connect_args={"connect_timeout": 10, "prepare_threshold": None},
    )

    @event.listens_for(engine, "connect")
    def private_search_path(connection, _):
        previous = connection.autocommit
        connection.autocommit = True
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SET search_path TO {PRIVATE_SCHEMA}, pg_catalog")
        finally:
            connection.autocommit = previous

    return engine


def acquire_authority_lock(session: Session):
    """First operation in a trusted transaction, before reading authority or audit.

    PostgreSQL READ COMMITTED refreshes the next statement's snapshot after a
    waiting transaction acquires the lock. Repeatable-read snapshots are refused.
    Every writer must cooperate; this does not protect against a database admin.
    """
    connection = session.connection()
    if connection.dialect.name == "sqlite":
        connection.exec_driver_sql("BEGIN IMMEDIATE")
    elif connection.dialect.name == "postgresql":
        if connection.get_isolation_level() != "READ COMMITTED":
            raise ValueError("Authority lock requires READ COMMITTED isolation")
        connection.exec_driver_sql("SET LOCAL lock_timeout = '10s'")
        connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": AUTHORITY_LOCK})
    else:
        raise ValueError("Unsupported authority transaction dialect")
