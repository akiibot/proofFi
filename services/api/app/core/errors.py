from app.models.contracts import ErrorCode


class DomainError(Exception):
    def __init__(self, code: ErrorCode, message: str, status: int = 503):
        self.code, self.message, self.status = code, message, status


def unfinished(issue: str):
    raise DomainError(
        ErrorCode.NOT_IMPLEMENTED, f"Feature awaiting {issue}; no action performed", 501
    )
