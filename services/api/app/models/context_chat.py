"""Research observations and explanations; never financial authority."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.models.contracts import Contract
from app.models.page_context import PageAnalysisRequest, ResearchSource


class ContextMetric(Contract):
    label: str
    value: str
    quote: str
    source_id: str


class FeeObservation(Contract):
    annual_bps: Annotated[int, Field(strict=True, ge=0, le=10000)]
    quote: str
    source_id: str


class ContextBrief(Contract):
    kind: Literal["product", "directory", "expense", "unknown"]
    name: str
    summary: str
    facts: Annotated[list[ContextMetric], Field(max_length=12)]
    fee: FeeObservation | None
    sources: Annotated[list[ResearchSource], Field(max_length=6)]
    research_message: str
    financial_authority: Literal[False] = False


class ContextMessage(Contract):
    role: Literal["user", "assistant"]
    text: Annotated[str, StringConstraints(min_length=1, max_length=2400)]


class ContextChatRequest(PageAnalysisRequest):
    question: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]
    history: Annotated[list[ContextMessage], Field(max_length=12)] = []


class ContextAnswer(Contract):
    status: Literal["available", "unavailable"]
    answer: str
    cited_source_ids: list[str]
    suggested_questions: list[str]
    sources: Annotated[list[ResearchSource], Field(max_length=6)]
    provider_mode: Literal["live_llm", "unavailable"]
    financial_authority: Literal[False] = False
