"""User-requested page interpretation. No financial writes or URL fetching."""
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response

from app.models.page_context import PageAnalysisRequest, PageAnalysisResponse, PageFact
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
    wanted = {"fees", "liquidity", "currency"} if body.page_kind == "investment" else {"billing", "currency"}
    return PageAnalysisResponse(
        page_kind=body.page_kind, source_url=body.source_url, observed_at=datetime.now(UTC),
        facts=facts, sources=sources, research_status=status, research_message=message,
        missing_fields=sorted(wanted - present), warnings=[
            "Page statements are unverified claims. No product suitability or financial permission is established.",
            "Historical performance, reviews and comparable-investor outcomes are unavailable unless sourced separately.",
        ],
    )
