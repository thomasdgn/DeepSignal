from __future__ import annotations

from collections.abc import Iterable

from deepsignal.models import WhaleAlert
from deepsignal.sponsors.elfa_client import ElfaApiClient


class ElfaSignalEnricher:
    """
    Lightweight sponsor hook.

    This keeps the app architecture ready for ELFA AI enrichment without forcing
    a hard dependency on their API until the team decides what exact signal to use.
    """

    def __init__(self, api_key: str | None, base_url: str = "https://api.elfa.ai") -> None:
        self.api_key = api_key
        self.base_url = base_url

    def enrich(self, alert: WhaleAlert) -> WhaleAlert:
        enrichment = {
            **alert.enrichment,
            "elfa_focus": self._build_focus_terms(alert.tags),
            "elfa_symbol": alert.trade.symbol,
            "elfa_side_bias": alert.trade.side,
        }

        if not self.api_key:
            return WhaleAlert(
                trade=alert.trade,
                threshold_usd=alert.threshold_usd,
                tags=alert.tags,
                enrichment={
                    **enrichment,
                    "elfa_status": "disabled",
                    "elfa_note": (
                        "Add ELFA_API_KEY to enrich whale alerts with external social context."
                    ),
                },
            )

        return WhaleAlert(
            trade=alert.trade,
            threshold_usd=alert.threshold_usd,
            tags=alert.tags + ("elfa-enriched",),
            enrichment={
                **enrichment,
                "elfa_status": "ready",
                **self._fetch_context(alert),
            },
        )

    def _build_focus_terms(self, tags: Iterable[str]) -> list[str]:
        tokens = ["pacifica"]
        for tag in tags:
            normalized = tag.replace("_", "-")
            if normalized not in tokens:
                tokens.append(normalized)
        return tokens

    def _fetch_context(self, alert: WhaleAlert) -> dict[str, object]:
        assert self.api_key is not None
        client = ElfaApiClient(api_key=self.api_key, base_url=self.base_url)
        try:
            mentions = client.get_top_mentions(alert.trade.symbol, time_window="1h", page_size=3)
            news = client.get_token_news(alert.trade.symbol, time_window="24h", page_size=3)
            narratives = client.get_trending_narratives(time_window="24h", page_size=5)
        except RuntimeError as exc:
            return {
                "elfa_status": "error",
                "elfa_note": str(exc),
            }

        return {
            "elfa_status": "live",
            "elfa_note": "ELFA context fetched successfully.",
            "elfa_top_mentions_count": _count_items(mentions),
            "elfa_token_news_count": _count_items(news),
            "elfa_trending_narratives_count": _count_items(narratives),
            "elfa_top_mentions_preview": _extract_preview_text(mentions),
            "elfa_token_news_preview": _extract_preview_text(news),
            "elfa_trending_narratives_preview": _extract_preview_text(narratives),
            "elfa_attention_score": _build_attention_score(mentions, news, narratives),
            "elfa_market_signal": _build_market_signal(mentions, news, narratives),
            "elfa_explainer": _build_explainer(mentions, news, narratives),
        }


def _count_items(payload: dict[str, object]) -> int:
    data = payload.get("data", [])
    if isinstance(data, list):
        return len(data)
    return 0


def _extract_preview_text(payload: dict[str, object], limit: int = 3) -> list[str]:
    data = payload.get("data", [])
    if not isinstance(data, list):
        return []

    preview: list[str] = []
    for item in data[:limit]:
        if not isinstance(item, dict):
            continue
        for field in ("title", "summary", "text", "content", "name"):
            value = item.get(field)
            if isinstance(value, str) and value.strip():
                preview.append(value.strip()[:160])
                break
    return preview


def _build_attention_score(
    mentions: dict[str, object],
    news: dict[str, object],
    narratives: dict[str, object],
) -> float:
    score = (
        _count_items(mentions) * 12
        + _count_items(news) * 10
        + _count_items(narratives) * 8
    )
    return float(min(score, 100))


def _build_market_signal(
    mentions: dict[str, object],
    news: dict[str, object],
    narratives: dict[str, object],
) -> str:
    attention_score = _build_attention_score(mentions, news, narratives)
    if attention_score >= 70:
        return "high-attention"
    if attention_score >= 35:
        return "rising-attention"
    return "low-attention"


def _build_explainer(
    mentions: dict[str, object],
    news: dict[str, object],
    narratives: dict[str, object],
) -> list[str]:
    lines: list[str] = []

    mention_preview = _extract_preview_text(mentions, limit=2)
    if mention_preview:
        lines.append(f"Mentions: {' | '.join(mention_preview)}")

    news_preview = _extract_preview_text(news, limit=2)
    if news_preview:
        lines.append(f"News: {' | '.join(news_preview)}")

    narrative_preview = _extract_preview_text(narratives, limit=2)
    if narrative_preview:
        lines.append(f"Narratives: {' | '.join(narrative_preview)}")

    if not lines:
        lines.append("ELFA returned limited narrative context for this symbol.")

    return lines
