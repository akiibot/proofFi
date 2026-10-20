"""User-requested page interpretation. No financial writes or URL fetching."""

import asyncio
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from fastapi import APIRouter, Request, Response

from app.core.errors import DomainError
from app.models.context_chat import ContextAnswer, ContextBrief, ContextChatRequest
from app.models.contracts import ErrorCode
from app.models.page_context import PageAnalysisRequest, PageAnalysisResponse, PageFact
from app.planner.provider import PlannerSettings
from app.research.brief import brief
from app.research.chat_provider import explain
from app.research.wigolo import search_wigolo

router = APIRouter()
PATTERNS = {
    "fees": r"\b(fee|fees|expense ratio|commission|charges?)\b",
    "liquidity": r"\b(withdraw|withdrawal|redemption|lock.up|notice period|liquidity)\b",
    "billing": r"\b(monthly|annually|yearly|next payment|renewal|due date|per month)\b",
    "currency": r"\b(USD|GBP|EUR|BDT)\b",
}


@router.post("/context/analyse", response_model=PageAnalysisResponse, operation_id="analyse_page")
async def analyse_page(body: PageAnalysisRequest, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    require_public_context(body)
    facts = [PageFact(field="product", excerpt=body.title, source_url=body.source_url)]
    lines = [line.strip() for line in body.selected_text.splitlines() if line.strip()]
    for field, pattern in PATTERNS.items():
        line = next((line for line in lines if re.search(pattern, line, re.I)), None)
        if line:
            facts.append(PageFact(field=field, excerpt=line[:500], source_url=body.source_url))
    sources, message = [], "External research was not requested."
    status = "not_requested"
    if body.external_research:
        sources, message = await search_wigolo(body.product_name, request.app.state.auth.settings)
        status = "available" if sources else "unavailable"
    present = {fact.field for fact in facts}
    wanted = (
        {"fees", "liquidity", "currency"}
        if body.page_kind == "investment"
        else {"billing", "currency"}
    )
    return PageAnalysisResponse(
        page_kind=body.page_kind,
        source_url=body.source_url,
        observed_at=datetime.now(UTC),
        facts=facts,
        sources=sources,
        research_status=status,
        research_message=message,
        missing_fields=sorted(wanted - present),
        warnings=[
            "Page statements are unverified claims. No product suitability or financial permission is established.",
            "Historical performance, reviews and comparable-investor outcomes are unavailable unless sourced separately.",
        ],
    )


@router.post("/context/brief", response_model=ContextBrief, operation_id="context_brief")
async def context_brief(body: PageAnalysisRequest, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    require_public_context(body)
    return await brief(body, request.app.state.auth.settings)


@router.post("/context/chat", response_model=ContextAnswer, operation_id="context_chat")
async def context_chat(body: ContextChatRequest, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    require_public_context(body)
    evidence = await brief(body, request.app.state.auth.settings)
    source_data = [{"id": "page", "title": body.title, "text": body.selected_text}] + [
        {"id": f"source-{i}", "title": s.title, "text": s.excerpt}
        for i, s in enumerate(evidence.sources[1:], 1)
    ]
    payload = {
        "product": evidence.name,
        "kind": evidence.kind,
        "question": body.question,
        "history": [m.model_dump() for m in body.history],
        "sources": source_data,
    }
    try:
        if not request.app.state.auth.settings.context_chat_enabled:
            raise ValueError("Context chat not enabled")
        result = await asyncio.to_thread(explain, payload, PlannerSettings())
        return ContextAnswer(
            status="available",
            answer=result.answer,
            cited_source_ids=result.cited_source_ids,
            suggested_questions=result.suggested_questions,
            sources=evidence.sources,
            provider_mode="live_llm",
        )
    except Exception:
        return ContextAnswer(
            status="unavailable",
            answer="Live conversation is unavailable right now. You can still inspect the sourced product details. Try again when the provider is connected.",
            cited_source_ids=[],
            suggested_questions=[],
            sources=evidence.sources,
            provider_mode="unavailable",
        )


def require_public_context(body):
    private_path = re.search(
        r"\b(account|checkout|payment|login|signin|sign-in|dashboard|portfolio|billing)\b",
        urlsplit(body.source_url).path,
        re.I,
    )
    private_content = re.search(
        r"\b(my (?:account|portfolio|holdings|investments)|account balance|account value|net worth|available cash|positions and transactions|welcome back|sign in to (?:view|manage)|your (?:holdings|portfolio value|account balance|balance)|buy or sell|sell your shares)\b",
        f"{body.title}\n{body.selected_text}",
        re.I,
    )
    if private_path or private_content:
        raise DomainError(
            ErrorCode.FORBIDDEN,
            "Open a public product page; private account and payment pages are excluded",
            403,
        )
