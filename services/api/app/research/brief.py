"""Conservative product identity and source-backed cost observations."""

import re
from datetime import UTC, datetime
from decimal import Decimal

from app.models.context_chat import ContextBrief, ContextMetric, FeeObservation
from app.models.page_context import ResearchSource
from app.research.wigolo import search_wigolo


def directory(body):
    from urllib.parse import urlsplit

    path = urlsplit(body.source_url).path.rstrip("/")
    return path in ("", "/us", "/us/individual", "/personal") or bool(
        re.search(r"/(overview|all-funds|funds-list)$", path)
    )


async def brief(body, settings):
    sources = [
        ResearchSource(
            title=body.title,
            url=body.source_url,
            excerpt=body.selected_text[:700],
            observed_at=datetime.now(UTC),
        )
    ]
    kind = (
        "directory"
        if directory(body)
        else "expense"
        if body.page_kind == "expense"
        else "product"
        if body.page_kind == "investment"
        else "unknown"
    )
    external = []
    message = "Using this page. Open Sources & privacy for details."
    if body.external_research and kind in ("product", "directory") and body.product_name:
        external, message = await search_wigolo(body.product_name, settings)
    seen = {body.source_url}
    for source in external:
        if source.url not in seen:
            sources.append(source)
            seen.add(source.url)
    fee = None
    # Only a directly quoted annual expense ratio, never a yield or generic percentage.
    if not directory(body):
        match = re.search(
            r"(?:net |gross |annual )?expense ratio\s*:?\s*(?:Fees as stated in (?:the )?prospectus\s*)?(?:Expense Ratio\s*:?\s*)?(\d+(?:\.\d+)?)\s*%",
            body.selected_text,
            re.I,
        )
        if match:
            bps = Decimal(match.group(1)) * 100
            if bps == int(bps) and 0 <= bps <= 10000:
                fee = FeeObservation(
                    annual_bps=int(bps), quote=match.group(0)[:500], source_id="page"
                )
    facts = []
    for label, pattern in [
        ("Access to your money", r"\b(redemption|withdrawal|lock.up|notice period)\b"),
        ("Renewal terms", r"\b(auto.?renew|cancel|billed monthly|billed annually)\b"),
    ]:
        if label == "Renewal terms" and kind != "expense":
            continue
        line = next(
            (
                line.strip()
                for line in body.selected_text.splitlines()
                if re.search(pattern, line, re.I)
            ),
            None,
        )
        if line:
            facts.append(
                ContextMetric(label=label, value=line[:240], quote=line[:500], source_id="page")
            )
    summary = {
        "directory": "There are several products here. Open a specific fund or tell me which one interests you.",
        "product": "Let’s understand what this product costs and what deserves a closer look.",
        "expense": "See the recurring cost and terms before taking on another commitment.",
        "unknown": "Tell me which product or bill you want to understand.",
    }[kind]
    return ContextBrief(
        kind=kind,
        name=body.product_name or body.title,
        summary=summary,
        facts=facts,
        fee=fee,
        sources=sources,
        research_message=message,
    )
