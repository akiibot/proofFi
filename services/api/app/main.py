from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.approvals.router import router as approvals
from app.core.auth import SessionManager
from app.core.errors import DomainError
from app.core.settings import Settings
from app.db.models import AuditRecord, ConstitutionDraftRecord
from app.db.session import make_engine, sessions
from app.db.state import read_state
from app.demo.router import router as demo
from app.execution.router import router as execution
from app.execution.status import read_status
from app.models.contracts import (
    ApiError,
    AuditEvent,
    ChainStatus,
    ConstitutionDraft,
    ErrorCode,
    FinancialState,
    Health,
)
from app.optimizer.router import router as optimizer
from app.planner.router import router as planner
from app.policy.router import router as policy
from app.simulation.router import router as simulation
from app.verifier.router import router as verifier
from app.workflows.router import router as workflows


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    engine = make_engine(settings.database_url)
    factory = sessions(engine)
    app = FastAPI(
        title="Vallet",
        version="1.2.0",
        description="Foundation contract; unfinished capabilities return NOT_IMPLEMENTED.",
        responses={
            401: {"model": ApiError},
            403: {"model": ApiError},
            429: {"model": ApiError},
            409: {"model": ApiError},
            422: {"model": ApiError},
            501: {"model": ApiError},
            503: {"model": ApiError},
        },
    )
    app.state.engine = engine
    auth = SessionManager(settings)
    app.state.auth = auth
    authenticate = auth.authenticate
    app.include_router(auth.router())

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status,
            content=ApiError(code=exc.code, message=exc.message).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Never echo arbitrary user input (which can contain secrets).
        return JSONResponse(
            status_code=422,
            content=ApiError(
                code=ErrorCode.VALIDATION_ERROR,
                message="Request does not match contract",
                reasons=[".".join(map(str, e["loc"])) for e in exc.errors()],
            ).model_dump(),
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        return JSONResponse(
            status_code=503,
            content=ApiError(
                code=ErrorCode.UNAVAILABLE, message="Database unavailable; no authorization granted"
            ).model_dump(),
        )

    @app.get("/health", response_model=Health, operation_id="health")
    def health():
        with factory() as session:
            revision = session.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if revision is None:
                raise DomainError(ErrorCode.UNAVAILABLE, "Database migration required")
        return Health(status="ok")

    @app.get("/financial-state", response_model=FinancialState, operation_id="financial_state")
    def state(actor: str = Depends(authenticate)):
        with factory() as session:
            return read_state(session, actor)

    @app.get(
        "/constitutions/drafts", response_model=list[ConstitutionDraft], operation_id="list_drafts"
    )
    def drafts(actor: str = Depends(authenticate)):
        with factory() as session:
            return [
                ConstitutionDraft.model_validate(x.payload)
                for x in session.scalars(
                    select(ConstitutionDraftRecord).where(ConstitutionDraftRecord.user_id == actor)
                )
            ]

    @app.get("/audit", response_model=list[AuditEvent], operation_id="audit")
    def audit(actor: str = Depends(authenticate)):
        with factory() as session:
            return [
                AuditEvent.model_validate(x.payload)
                for x in session.scalars(select(AuditRecord).order_by(AuditRecord.sequence))
            ]

    @app.get(
        "/chain/status",
        response_model=ChainStatus,
        operation_id="chain_status",
        dependencies=[Depends(authenticate)],
    )
    def chain_status():
        return read_status()

    for router in (
        planner,
        policy,
        simulation,
        optimizer,
        verifier,
        approvals,
        execution,
        workflows,
    ):
        app.include_router(router, dependencies=[Depends(authenticate)])
    if settings.demo_mode:
        app.include_router(demo, dependencies=[Depends(authenticate)])
    return app


app = create_app()
