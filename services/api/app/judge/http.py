"""Direct-backend streaming admission; independent of the frontend proxy."""

import asyncio

from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.errors import DomainError
from app.models.contracts import ApiError, ErrorCode


def failure(exc):
    return JSONResponse(
        ApiError(code=exc.code, message=exc.message).model_dump(), status_code=exc.status
    )


BODY_SECONDS = 10


async def bounded_receive(receive):
    try:
        return await asyncio.wait_for(_read(receive), timeout=BODY_SECONDS)
    except TimeoutError:
        raise DomainError(ErrorCode.UNAVAILABLE, "Judge request body timed out", 408) from None


async def _read(receive):
    body = bytearray()
    while True:
        message = await receive()
        if message["type"] != "http.request":
            raise DomainError(ErrorCode.UNAVAILABLE, "Request interrupted")
        chunk = message.get("body", b"")
        if len(body) + len(chunk) > 65536:
            raise DomainError(ErrorCode.VALIDATION_ERROR, "Request too large", 413)
        body.extend(chunk)
        if not message.get("more_body", False):
            break
    sent = False

    async def replay():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}
        return await receive()

    return replay


class JudgeDispatcher:
    def __init__(self, app, registry):
        self.app, self.registry = app, registry

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope)
        token = request.cookies.get("prooffi_session")
        # Public entry and operator login must use the root application.
        path = scope["path"].rstrip("/") or "/"
        try:
            self.registry.cleanup()
            if path == "/auth/judge":
                self.registry.entry_admit(request)
                with self.registry.computation(True):
                    receive = await bounded_receive(receive)
            if path in ("/auth/login", "/auth/judge"):

                async def switched(message):
                    if message["type"] == "http.response.start" and message["status"] == 200:
                        if path == "/auth/login":
                            self.registry.revoke(token)
                    await send(message)

                return await self.app(scope, receive, switched)
            with self.registry.lease(token) as guest:
                if guest is None:
                    return await self.app(scope, receive, send)
                from app.judge.access import EXPENSIVE, allowed

                allowed(scope["method"], path)
                self.registry.admit(guest, path)
                with self.registry.computation(True):
                    receive = await bounded_receive(receive)
                with self.registry.computation(path in EXPENSIVE):
                    # Starlette/FastAPI request.app now points at this fixed child app.
                    await guest.app(dict(scope), receive, send)
        except DomainError as exc:
            await failure(exc)(scope, receive, send)
