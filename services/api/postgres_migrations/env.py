"""Separate PostgreSQL history: never stamp/import an existing SQLite database."""

from alembic import context
from app.core.settings import Settings
from app.db.models import Base
from app.db.postgres import PRIVATE_SCHEMA, make_postgres_engine

if context.is_offline_mode():
    raise RuntimeError("PostgreSQL migrations require a live database for safety checks")

engine = make_postgres_engine(Settings().database_url)
try:
    with engine.connect() as connection:
        connection.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {PRIVATE_SCHEMA}")
        connection.exec_driver_sql(f"REVOKE ALL ON SCHEMA {PRIVATE_SCHEMA} FROM PUBLIC")
        connection.commit()
        # The first connection can precede schema creation. Reflection must use
        # this private namespace rather than the pg_catalog fallback.
        connection.dialect.default_schema_name = PRIVATE_SCHEMA
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            version_table_schema=PRIVATE_SCHEMA,
            compare_type=True,
            include_object=lambda obj, name, kind, reflected, compare_to: (
                not (kind == "table" and name == "alembic_version")
            ),
        )
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
