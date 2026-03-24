from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class MarketInfo:
    symbol: str
    tick_size: str
    lot_size: str
    max_leverage: int
    funding_rate: str
    next_funding_rate: str


@dataclass(frozen=True)
class Trade:
    symbol: str
    price: float
    amount: float
    side: str
    cause: str
    timestamp_ms: int
    sequence_id: int | None = None
    source: str = "unknown"

    @property
    def notional_usd(self) -> float:
        return self.price * self.amount

    @property
    def timestamp(self) -> datetime:
        return datetime.fromtimestamp(self.timestamp_ms / 1000, tz=timezone.utc)


@dataclass(frozen=True)
class WhaleAlert:
    trade: Trade
    threshold_usd: float
    tags: tuple[str, ...] = field(default_factory=tuple)
    score: float = 0.0
    score_breakdown: dict[str, Any] = field(default_factory=dict)
    enrichment: dict[str, Any] = field(default_factory=dict)

    @property
    def severity(self) -> str:
        multiple = self.trade.notional_usd / self.threshold_usd
        if multiple >= 10:
            return "critical"
        if multiple >= 3:
            return "high"
        return "medium"
