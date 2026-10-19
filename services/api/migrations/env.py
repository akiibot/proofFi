from alembic import context
from app.core.settings import Settings
from app.db.models import Base
from app.db.session import make_engine

config = context.config
url = Settings().database_url
if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    context.configure(
        connection=config.attributes["connection"],
        target_metadata=Base.metadata,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    with make_engine(url).connect() as connection:
        context.configure(
            connection=connection, target_metadata=Base.metadata, render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()
