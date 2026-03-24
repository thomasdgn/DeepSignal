from __future__ import annotations

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

        return WhaleAlert(
            trade=trade,
            threshold_usd=self.threshold_usd,
            tags=tuple(tags),
        )
