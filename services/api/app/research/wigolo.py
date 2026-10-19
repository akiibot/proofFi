"""Optional local Wigolo search. Never passes cookies, prompts or financial state."""
import json
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx

from app.models.page_context import ResearchSource

MAX_RESPONSE_BYTES = 262144


async def search_wigolo(product: str, settings) -> tuple[list[ResearchSource], str]:
    if not settings.wigolo_enabled or not settings.research_domains:
        return [], "Wigolo research is not configured with approved source domains."
    if not product:
        return [], "Confirm a public product name before requesting external research."
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=False, trust_env=False) as client:
            async with client.stream("POST", settings.wigolo_url + "/v1/search", json={
                "query": product, "include_domains": settings.research_domains,
                "max_results": 5, "search_depth": "fast",
            }) as response:
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise ValueError("Oversized research response")
        result = json.loads(body)
        if not isinstance(result, dict) or result.get("error") or not isinstance(result.get("results"), list):
            raise ValueError("Research results unavailable")
        sources = []
        for item in result["results"][:5]:
            if not isinstance(item, dict):
                continue
            host = (urlsplit(str(item.get("url", ""))).hostname or "").lower()
            if not any(host == domain or host.endswith("." + domain) for domain in settings.research_domains):
                continue
            try:
                sources.append(ResearchSource(
                    title=str(item.get("title", "Untitled source"))[:240] or "Untitled source",
                    url=item.get("url", ""),
                    excerpt=str(item.get("excerpt", item.get("snippet", "")))[:700],
                    observed_at=datetime.now(UTC),
                    published_at=str(item["published_at"])[:100] if item.get("published_at") else None,
                    cached=item.get("cached") if isinstance(item.get("cached"), bool) else None,
                ))
            except ValueError:
                continue
        message = "Search excerpts are unverified evidence, not investment advice or permission."
        if result.get("warning"):
            message += " Provider reported degraded results; inspect each source."
        return sources, message if sources else "No usable evidence returned from approved domains."
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        return [], "Wigolo is unavailable or returned unusable evidence. No financial permission was granted."
