"""Real isolated PostgreSQL databases; missing infrastructure is a failure, never a skip."""

import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from app.db.postgres import make_postgres_engine
from app.db.session import sessions
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


@pytest.fixture
def pg_database(monkeypatch):
    admin_url = make_url(os.environ["PROOFFI_TEST_POSTGRES_URL"])
    if admin_url.host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("Destructive database tests require an isolated loopback PostgreSQL")
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT", hide_parameters=True)
    name = "pf046_" + uuid4().hex
    url = admin_url.set(database=name).render_as_string(hide_password=False)
    with admin.connect() as connection:
        connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
        for role in ("anon", "authenticated", "service_role"):
            if not connection.scalar(
                text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}
            ):
                bypass = " BYPASSRLS" if role == "service_role" else ""
                connection.exec_driver_sql(f'CREATE ROLE "{role}" NOLOGIN{bypass}')
    engine = None
    try:
        monkeypatch.setenv("DATABASE_URL", url)
        command.upgrade(Config("alembic-postgres.ini"), "head")
        engine = make_postgres_engine(url)
        yield url, engine, sessions(engine)
    finally:
        if engine is not None:
            engine.dispose()
        with admin.connect() as connection:
            connection.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname=:name AND pid<>pg_backend_pid()"
                ),
                {"name": name},
            )
            connection.exec_driver_sql(f'DROP DATABASE "{name}"')
        admin.dispose()
