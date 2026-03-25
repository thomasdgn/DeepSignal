from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SYMBOL_BASE = {
    "BTC": {
        "displayName": "Bitcoin Perpetuals",
        "price": "Live feed",
        "changePct": 0.0,
        "thesis": "BTC remains the macro anchor for whale conviction and flow confirmation.",
    },
    "ETH": {
        "displayName": "Ethereum Perpetuals",
        "price": "Live feed",
        "changePct": 0.0,
        "thesis": "ETH captures rotation and two-sided positioning shifts more than clean trend continuation.",
    },
    "SOL": {
        "displayName": "Solana Perpetuals",
        "price": "Live feed",
        "changePct": 0.0,
        "thesis": "SOL tends to carry the fastest momentum bursts and the highest social acceleration.",
    },
}


def render_terminal_payload(report_path: Path, dashboard_data: dict[str, Any]) -> Path:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    payload = build_terminal_payload(dashboard_data)
    report_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return report_path


def build_terminal_payload(dashboard_data: dict[str, Any]) -> dict[str, Any]:
    directional_by_symbol = {
        item["symbol"]: item for item in dashboard_data.get("directional_flow", [])
    }
    hot_by_symbol = {
        item["symbol"]: item for item in dashboard_data.get("hot_symbols", [])
    }
    narrative_by_symbol = {
        item["symbol"]: item for item in dashboard_data.get("narrative_summary", [])
    }

    symbols = []
    for symbol in _ordered_symbols(dashboard_data):
        base = SYMBOL_BASE.get(
            symbol,
            {
                "displayName": f"{symbol} Perpetuals",
                "price": "Live feed",
                "changePct": 0.0,
                "thesis": "No symbol-specific thesis available yet.",
            },
        )
        directional = directional_by_symbol.get(symbol, {})
        hot = hot_by_symbol.get(symbol, {})
        narrative = narrative_by_symbol.get(symbol, {})
        net_flow = float(directional.get("net_flow_usd", 0) or 0)
        attention = int(round(float(hot.get("avg_attention_score", 0) or 0)))
        avg_score = float(hot.get("avg_score", 0) or 0)
        hot_score = float(hot.get("hot_score", avg_score) or avg_score)
        confidence = int(round((avg_score * 0.62) + (attention * 0.38))) if (avg_score or attention) else 0
        direction = "mixed"
        if net_flow > 50_000:
            direction = "bullish"
        elif net_flow < -50_000:
            direction = "bearish"

        highlights = [
            f"{int(hot.get('event_count', 0) or 0)} qualifying alert(s) in the current window",
            f"Net flow {_format_signed_short_usd(net_flow)}",
            str(narrative.get("market_signal", "No ELFA market signal yet")),
        ]
        thesis = _narrative_text(symbol, narrative) or base["thesis"]
        symbols.append(
            {
                "symbol": symbol,
                "displayName": base["displayName"],
                "price": base["price"],
                "changePct": base["changePct"],
                "hotScore": round(hot_score, 1),
                "attention": attention,
                "direction": direction,
                "thesis": thesis,
                "dominantFlow": f"{_format_signed_short_usd(net_flow)} net {direction}",
                "confidence": confidence,
                "highlights": highlights,
            }
        )

    events = []
    for index, item in enumerate(dashboard_data.get("terminal_events", []), start=1):
        enrichment = item.get("enrichment", {})
        if not isinstance(enrichment, dict):
            enrichment = {}
        signal = _attention_signal(float(enrichment.get("elfa_attention_score", 0) or 0))
        narrative = _event_narrative(item, enrichment)
        events.append(
            {
                "id": f"evt-{index:02d}",
                "symbol": item["symbol"],
                "side": item["side"],
                "severity": item["severity"],
                "score": float(item["score"]),
                "notionalUsd": float(item["notional_usd"]),
                "timestamp": _iso_timestamp(int(item["timestamp_ms"])),
                "narrative": narrative,
                "signal": signal,
            }
        )

    narratives = []
    for item in dashboard_data.get("narrative_summary", []):
        narratives.append(
            {
                "title": f"{item['symbol']} Narrative",
                "copy": _narrative_text(item["symbol"], item),
            }
        )

    alert_inbox = []
    for item in dashboard_data.get("ranked_alerts", [])[:3]:
        alert_inbox.append(
            {
                "title": f"{item['symbol']} {item['side']}",
                "state": item["severity"],
                "note": f"Score {item['score']:.1f} with ${round(item['notional_usd'] / 1000):.0f}k notional",
            }
        )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "kpis": [
            {
                "label": "Whale Events",
                "value": str(dashboard_data.get("total_alerts", 0)),
                "note": f"last {dashboard_data.get('lookback_hours', 24)} hours",
            },
            {
                "label": "Tracked Notional",
                "value": f"${dashboard_data.get('total_notional_usd', 0):,.1f}",
                "note": "ranked flow",
            },
            {
                "label": "Highest Score",
                "value": f"{dashboard_data.get('highest_score', 0):.1f}",
                "note": "command priority",
            },
            {
                "label": "Largest Alert",
                "value": f"${dashboard_data.get('largest_alert_usd', 0):,.0f}",
                "note": "single event",
            },
        ],
        "symbols": symbols,
        "timeline": [
            {
                "hour": _short_hour(int(item["bucket_start_ms"])),
                "notional": float(item["total_notional_usd"]),
                "events": int(item["event_count"]),
            }
            for item in sorted(
                dashboard_data.get("timeline", []),
                key=lambda item: item["bucket_start_ms"],
            )
        ],
        "flowRows": [
            {
                "symbol": item["symbol"],
                "bullish": float(item["bullish_notional_usd"]),
                "bearish": float(item["bearish_notional_usd"]),
                "net": float(item["net_flow_usd"]),
            }
            for item in dashboard_data.get("directional_flow", [])
        ],
        "eventFeed": events,
        "narratives": narratives,
        "alertInbox": alert_inbox,
    }


def _ordered_symbols(dashboard_data: dict[str, Any]) -> list[str]:
    ordered = [item["symbol"] for item in dashboard_data.get("hot_symbols", [])]
    for collection in ("directional_flow", "narrative_summary"):
        for item in dashboard_data.get(collection, []):
            symbol = item["symbol"]
            if symbol not in ordered:
                ordered.append(symbol)
    return ordered or ["BTC", "ETH", "SOL"]


def _attention_signal(score: float) -> str:
    if score >= 80:
        return "high-attention"
    if score >= 55:
        return "rising-attention"
    return "low-attention"


def _event_narrative(item: dict[str, Any], enrichment: dict[str, Any]) -> str:
    explainer = enrichment.get("elfa_explainer", [])
    if isinstance(explainer, list) and explainer:
        return str(explainer[0])
    tags = item.get("tags", [])
    if isinstance(tags, list) and tags:
        return "Signal drivers: " + ", ".join(str(tag) for tag in tags[:3])
    return f"{item['symbol']} {item['side']} moved into the command queue without extra sponsor context yet."


def _narrative_text(symbol: str, narrative: dict[str, Any]) -> str:
    market_signal = str(narrative.get("market_signal", "narrative forming")).replace("_", " ")
    avg_attention = float(narrative.get("avg_attention_score", 0) or 0)
    avg_score = float(narrative.get("avg_score", 0) or 0)
    event_count = int(narrative.get("event_count", 0) or 0)
    return (
        f"{symbol} is running at {avg_score:.1f} average score with {avg_attention:.0f} attention "
        f"across {event_count} qualifying alert(s). Current narrative: {market_signal}."
    )


def _short_hour(timestamp_ms: int) -> str:
    if timestamp_ms <= 0:
        return "n/a"
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).strftime("%H:%M")


def _iso_timestamp(timestamp_ms: int) -> str:
    if timestamp_ms <= 0:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()


def _format_signed_short_usd(value: float) -> str:
    prefix = "+" if value > 0 else "-"
    return f"{prefix}${abs(value) / 1000:.0f}k"
