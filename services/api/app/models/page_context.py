"""Untrusted browser observations, deliberately separate from financial authority."""
import ipaddress
from typing import Annotated, Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import AwareDatetime, Field, StringConstraints, field_validator

from app.models.contracts import Contract

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]


def public_source(value: str) -> str:
    parts = urlsplit(value)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https") or not host or parts.username or parts.password:
        raise ValueError("Public HTTP(S) source required")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")) or "." not in host:
        raise ValueError("Private sources are not research targets")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and not address.is_global:
        raise ValueError("Private sources are not research targets")
    if parts.port not in (None, 80, 443):
        raise ValueError("Public source port required")
    # Queries/fragments can contain credentials or private account identifiers.
    return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path, "", ""))


class PageAnalysisRequest(Contract):
    source_url: Annotated[str, StringConstraints(max_length=2048)]
    title: ShortText
    page_kind: Literal["investment", "expense", "unknown"]
    selected_text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]
    research_consent: Literal[True]
    external_research: bool = False
    product_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""

    _public_url = field_validator("source_url")(public_source)


class PageFact(Contract):
    field: Literal["product", "fees", "liquidity", "billing", "currency"]
    excerpt: Annotated[str, StringConstraints(max_length=500)]
    source_url: str
    status: Literal["page_claim"] = "page_claim"


class ResearchSource(Contract):
    title: ShortText
    url: str
    excerpt: Annotated[str, StringConstraints(max_length=700)]
    observed_at: AwareDatetime
    published_at: Annotated[str, StringConstraints(max_length=100)] | None = None
    cached: bool | None = None
    _public_url = field_validator("url")(public_source)


class PageAnalysisResponse(Contract):
    page_kind: Literal["investment", "expense", "unknown"]
    source_url: str
    observed_at: AwareDatetime
    facts: Annotated[list[PageFact], Field(max_length=12)]
    sources: Annotated[list[ResearchSource], Field(max_length=5)]
    research_status: Literal["available", "unavailable", "not_requested"]
    research_message: str
    missing_fields: list[str]
    warnings: list[str]
    financial_authority: Literal[False] = False
