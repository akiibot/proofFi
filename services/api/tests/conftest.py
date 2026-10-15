import pytest
from alembic import command
from alembic.config import Config
from app.core.settings import Settings
from app.db.seed import seed
from app.db.session import make_engine, sessions
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import SecretStr


@pytest.fixture
def database(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    command.upgrade(Config("alembic.ini"), "head")
    engine = make_engine(url)
    factory = sessions(engine)
    with factory.begin() as session:
        seed(session)
    yield url, factory
    engine.dispose()


@pytest.fixture
def client(database):
    app = create_app(
        Settings(_env_file=None, database_url=database[0], api_token=SecretStr("test-credential"))
    )
    with TestClient(app) as c:
        c.headers["Authorization"] = "Bearer test-credential"
        yield c
    app.state.engine.dispose()
