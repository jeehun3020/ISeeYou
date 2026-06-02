import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import CHAR, TypeDecorator

from storage_db import Base


class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value if isinstance(value, uuid.UUID) else uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None or isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(160), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    result_json_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_kind: Mapped[str] = mapped_column(String(40), nullable=False, default="file")
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True, default="processing")
    result_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    real_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fake_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    inference_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    logs: Mapped[list["AnalysisLog"]] = relationship(
        "AnalysisLog",
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="AnalysisLog.id",
    )
    review: Mapped["AnalysisReview | None"] = relationship(
        "AnalysisReview",
        back_populates="analysis",
        cascade="all, delete-orphan",
        uselist=False,
    )


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="logs")


class AnalysisReview(Base):
    __tablename__ = "analysis_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    admin_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("admin_users.id"), nullable=True)
    reviewed_label: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    review_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True, default="unreviewed")
    error_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True, default="unreviewed")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataset_candidate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="review")
    admin: Mapped[AdminUser | None] = relationship("AdminUser")


class UserEvent(Base):
    __tablename__ = "user_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    page: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    modality: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
    )
