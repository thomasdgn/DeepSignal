from __future__ import annotations

from datetime import datetime, timedelta, timezone

from deepsignal.models import Trade, WhaleAlert


def build_demo_alerts(threshold_usd: float) -> list[WhaleAlert]:
    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(hours=10)
    templates = [
        ("BTC", 102_400, 1.8, "open_long", 82.4, "high-attention", 74.0, "ETF chatter and breakout positioning"),
        ("ETH", 3_250, 92, "open_short", 78.3, "rising-attention", 58.0, "Derivatives desks leaning into volatility"),
        ("SOL", 210, 950, "open_long", 88.6, "high-attention", 82.0, "High beta momentum attracting fast money"),
        ("BTC", 103_100, 2.4, "close_short", 76.2, "rising-attention", 49.0, "Short squeeze flow after impulsive move"),
        ("ETH", 3_180, 88, "close_long", 68.5, "low-attention", 24.0, "Profit taking after prior directional push"),
        ("SOL", 214, 1100, "open_long", 91.7, "high-attention", 86.0, "Social acceleration and breakout continuation"),
        ("BTC", 104_200, 3.1, "open_long", 95.2, "high-attention", 93.0, "Macro narrative and whale conviction align"),
        ("ETH", 3_300, 120, "open_short", 84.1, "rising-attention", 54.0, "Funding pressure building on bearish side"),
        ("SOL", 208, 800, "close_short", 72.8, "rising-attention", 44.0, "Dip buyers forcing quick unwind"),
        ("BTC", 105_050, 2.7, "open_long", 89.3, "high-attention", 88.0, "Whale follow-through after breakout confirmation"),
        ("ETH", 3_360, 140, "open_long", 87.5, "high-attention", 79.0, "Narrative shift toward risk-on beta"),
        ("SOL", 219, 1300, "open_long", 97.4, "high-attention", 95.0, "Crowded momentum with unusually strong attention"),
    ]

    alerts: list[WhaleAlert] = []
    for index, template in enumerate(templates):
        symbol, price, amount, side, score, signal, attention, story = template
        timestamp = int((base_time + timedelta(hours=index)).timestamp() * 1000)
        trade = Trade(
            symbol=symbol,
            price=float(price),
            amount=float(amount),
            side=side,
            cause="normal",
            timestamp_ms=timestamp,
            source="demo",
        )
        alerts.append(
            WhaleAlert(
                trade=trade,
                threshold_usd=threshold_usd,
                tags=(side, "demo-seed", signal),
                score=score,
                score_breakdown={
                    "multiple_of_threshold": round(trade.notional_usd / threshold_usd, 2),
                    "size_score": round(min(score - 12, 70), 2),
                    "side_bonus": 8.0 if "open" in side else 4.0,
                    "source_bonus": 3.0,
                    "total": score,
                },
                enrichment={
                    "elfa_status": "demo",
                    "elfa_market_signal": signal,
                    "elfa_attention_score": attention,
                    "elfa_explainer": [
                        f"Mentions: {story}",
                        f"Narratives: {symbol} is showing seeded {signal} social momentum",
                    ],
                    "elfa_top_mentions_count": 3,
                    "elfa_token_news_count": 2,
                    "elfa_trending_narratives_count": 2,
                },
            )
        )
    return alerts
