from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


def make_engine(url: str):
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 10}
        if url.startswith("sqlite")
        else {},
    )
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def configure_sqlite(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA busy_timeout=10000")

    return engine


def sessions(engine):
    return sessionmaker(engine, expire_on_commit=False)
