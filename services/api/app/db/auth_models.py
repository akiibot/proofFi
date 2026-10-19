"""Local SQLite authentication metadata, separate from the financial/PG contract."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.db.models import User


class LocalAuthBase(DeclarativeBase):
    pass


class ExtensionConnectionRecord(LocalAuthBase):
    __tablename__ = "extension_connections"
    extension_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey(User.id))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
