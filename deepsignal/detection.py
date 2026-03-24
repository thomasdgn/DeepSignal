from __future__ import annotations

from math import log10

from deepsignal.models import Trade, WhaleAlert


class WhaleDetector:
    def __init__(self, threshold_usd: float) -> None:
        self.threshold_usd = threshold_usd

    def evaluate(self, trade: Trade) -> WhaleAlert | None:
        if trade.notional_usd < self.threshold_usd:
            return None

        tags = [trade.side, trade.cause]
        if trade.notional_usd >= self.threshold_usd * 10:
            tags.append("mega-whale")
        elif trade.notional_usd >= self.threshold_usd * 3:
            tags.append("whale")

        score_breakdown = self._build_score(trade)

        return WhaleAlert(
            trade=trade,
            threshold_usd=self.threshold_usd,
            tags=tuple(tags),
            score=score_breakdown["total"],
            score_breakdown=score_breakdown,
        )

    def _build_score(self, trade: Trade) -> dict[str, float]:
        multiple = trade.notional_usd / self.threshold_usd
        size_score = min(55.0, 20.0 + log10(max(multiple, 1.0)) * 35.0)

        side_bonus = 8.0 if "open" in trade.side else 4.0
        liquidation_bonus = 18.0 if "liquid" in trade.cause.lower() else 0.0
        source_bonus = 5.0 if trade.source == "ws" else 2.0

        total = round(size_score + side_bonus + liquidation_bonus + source_bonus, 2)
        return {
            "size_score": round(size_score, 2),
            "side_bonus": side_bonus,
            "liquidation_bonus": liquidation_bonus,
            "source_bonus": source_bonus,
            "multiple_of_threshold": round(multiple, 2),
            "total": total,
        }
