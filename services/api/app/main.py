import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, Request, Response
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


def create_app(
    settings: Settings | None = None, *, judge_scope=None, judge_runtime=None, judge_engine=None
):
    settings = settings or Settings()
    engine = make_engine(settings.database_url) if judge_engine is None else judge_engine
    factory = sessions(engine)

    @asynccontextmanager
    async def lifespan(instance):
        async def expire():
            while True:
                await asyncio.sleep(15)
                await asyncio.to_thread(instance.state.judges.cleanup)

        task = asyncio.create_task(expire()) if judge_scope is None else None
        try:
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
                await asyncio.to_thread(instance.state.judges.close)

    app = FastAPI(
        lifespan=lifespan,
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
    app.state.factory = factory
    app.state.judge_scope = judge_scope
    app.state.judge_runtime = judge_runtime
    auth = SessionManager(settings)
    auth.judge_scope = judge_scope
    app.state.auth = auth
    authenticate = auth.authenticate
    app.include_router(auth.router())

    from app.judge.access import access
    from app.models.contracts import JudgeSessionInfo, JudgeStartRequest, SessionAccess

    @app.get(
        "/auth/access",
        response_model=SessionAccess,
        operation_id="session_access",
        dependencies=[Depends(authenticate)],
    )
    def session_access(request: Request, response: Response):
        with auth._lock:
            _, session = auth._lookup(request.cookies.get("prooffi_session"))
        response.headers["Cache-Control"] = "no-store"
        return access(session.expires, judge_scope)

    if judge_scope is None:
        from app.judge.http import JudgeDispatcher
        from app.judge.scopes import JudgeRegistry

        def build_guest(url, scope_id, runtime, fixed_engine):
            guest_settings = settings.model_copy(
                update={
                    "database_url": url,
                    "demo_mode": True,
                    "judge_enabled": False,
                    "demo_password_hash": SecretStr(""),
                    "api_token": SecretStr(""),
                }
            )
            return create_app(
                guest_settings,
                judge_scope=scope_id,
                judge_runtime=runtime,
                judge_engine=fixed_engine,
            )

        from pydantic import SecretStr

        registry = JudgeRegistry(settings, auth, build_guest)
        app.state.judges = registry
        auth.token_reserved = registry.token_reserved
        app.add_middleware(JudgeDispatcher, registry=registry)

        @app.post(
            "/auth/judge", response_model=JudgeSessionInfo, operation_id="start_judge_session"
        )
        def start_judge(body: JudgeStartRequest, request: Request, response: Response):
            auth.require_origin(request)
            return registry.create(response, request.cookies.get("prooffi_session"))

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
        with app.state.factory() as session:
            revision = session.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if revision is None:
                raise DomainError(ErrorCode.UNAVAILABLE, "Database migration required")
        return Health(status="ok")

    @app.get("/financial-state", response_model=FinancialState, operation_id="financial_state")
    def state(actor: str = Depends(authenticate)):
        with app.state.factory() as session:
            return read_state(session, actor)

    @app.get(
        "/constitutions/drafts", response_model=list[ConstitutionDraft], operation_id="list_drafts"
    )
    def drafts(actor: str = Depends(authenticate)):
        with app.state.factory() as session:
            return [
                ConstitutionDraft.model_validate(x.payload)
                for x in session.scalars(
                    select(ConstitutionDraftRecord).where(ConstitutionDraftRecord.user_id == actor)
                )
            ]

    @app.get("/audit", response_model=list[AuditEvent], operation_id="audit")
    def audit(actor: str = Depends(authenticate)):
        with app.state.factory() as session:
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
        if judge_scope is None:
            return read_status()
        if judge_runtime is None or judge_runtime.read_settings is None:
            return ChainStatus(
                status="CHAIN_NOT_CONFIGURED", reason="Judge read-only chain unavailable"
            )
        return read_status(settings=judge_runtime.read_settings)

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
