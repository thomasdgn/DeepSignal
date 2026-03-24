from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import requests

from deepsignal.models import WhaleAlert


@dataclass(frozen=True)
class AlertDispatchResult:
    delivered: list[str]
    skipped_reason: str | None = None
    summary_emitted: bool = False


class AlertDispatcher:
    def __init__(
        self,
        *,
        min_score: float,
        dedup_seconds: int,
        symbol_cooldown_seconds: int,
        summary_threshold: int,
        discord_webhook_url: str | None = None,
        generic_webhook_url: str | None = None,
        timeout: int = 10,
    ) -> None:
        self.min_score = min_score
        self.dedup_seconds = dedup_seconds
        self.symbol_cooldown_seconds = symbol_cooldown_seconds
        self.summary_threshold = summary_threshold
        self.discord_webhook_url = discord_webhook_url
        self.generic_webhook_url = generic_webhook_url
        self.timeout = timeout
        self._last_alert_by_signature: dict[str, int] = {}
        self._last_delivery_by_symbol: dict[str, int] = {}
        self._suppressed_by_symbol: dict[str, list[WhaleAlert]] = {}

    def dispatch(self, alert: WhaleAlert) -> AlertDispatchResult:
        if alert.score < self.min_score:
            return AlertDispatchResult(delivered=[], skipped_reason="below-min-score")

        signature = self._signature(alert)
        timestamp_ms = alert.trade.timestamp_ms
        previous_signature_ts = self._last_alert_by_signature.get(signature)
        if previous_signature_ts is not None and timestamp_ms - previous_signature_ts < self.dedup_seconds * 1000:
            return AlertDispatchResult(delivered=[], skipped_reason="deduplicated")

        symbol = alert.trade.symbol
        previous_delivery_ts = self._last_delivery_by_symbol.get(symbol)
        if previous_delivery_ts is not None and timestamp_ms - previous_delivery_ts < self.symbol_cooldown_seconds * 1000:
            bucket = self._suppressed_by_symbol.setdefault(symbol, [])
            bucket.append(alert)
            if len(bucket) >= self.summary_threshold:
                delivered = self._dispatch_summary(symbol, bucket)
                self._suppressed_by_symbol[symbol] = []
                self._last_delivery_by_symbol[symbol] = timestamp_ms
                self._last_alert_by_signature[signature] = timestamp_ms
                return AlertDispatchResult(
                    delivered=delivered,
                    skipped_reason="cooldown-summary",
                    summary_emitted=bool(delivered),
                )
            self._last_alert_by_signature[signature] = timestamp_ms
            return AlertDispatchResult(delivered=[], skipped_reason="symbol-cooldown")

        delivered = self._dispatch_alert(alert)
        self._last_delivery_by_symbol[symbol] = timestamp_ms
        self._last_alert_by_signature[signature] = timestamp_ms
        self._suppressed_by_symbol[symbol] = []
        return AlertDispatchResult(delivered=delivered)

    def _dispatch_alert(self, alert: WhaleAlert) -> list[str]:
        delivered: list[str] = []
        if self.discord_webhook_url:
            self._post_discord(alert)
            delivered.append("discord")
        if self.generic_webhook_url:
            self._post_generic(alert)
            delivered.append("generic-webhook")
        return delivered

    def _dispatch_summary(self, symbol: str, alerts: list[WhaleAlert]) -> list[str]:
        delivered: list[str] = []
        max_score = max(alert.score for alert in alerts)
        total_notional = sum(alert.trade.notional_usd for alert in alerts)
        count = len(alerts)

        if self.discord_webhook_url:
            payload = {
                "content": (
                    f"DeepSignal summary for {symbol}\n"
                    f"Suppressed alerts: {count}\n"
                    f"Max score: {max_score:,.2f}\n"
                    f"Total suppressed notional: ${total_notional:,.2f}"
                )
            }
            self._post(self.discord_webhook_url, payload)
            delivered.append("discord")

        if self.generic_webhook_url:
            payload = {
                "summary": {
                    "symbol": symbol,
                    "suppressed_count": count,
                    "max_score": max_score,
                    "total_notional_usd": total_notional,
                },
                "alerts": [
                    {
                        "severity": alert.severity,
                        "score": alert.score,
                        "trade": asdict(alert.trade),
                    }
                    for alert in alerts
                ],
            }
            self._post(self.generic_webhook_url, payload)
            delivered.append("generic-webhook")

        return delivered

    def _post_discord(self, alert: WhaleAlert) -> None:
        trade = alert.trade
        enrichment = alert.enrichment if isinstance(alert.enrichment, dict) else {}
        signal = enrichment.get("elfa_market_signal", "n/a")
        explainer = enrichment.get("elfa_explainer", [])
        if not isinstance(explainer, list):
            explainer = []

        content_lines = [
            f"DeepSignal {alert.severity.upper()} whale alert",
            f"Symbol: {trade.symbol}",
            f"Side: {trade.side}",
            f"Notional: ${trade.notional_usd:,.2f}",
            f"Score: {alert.score:,.2f}",
            f"ELFA signal: {signal}",
        ]
        if explainer:
            content_lines.append(f"Context: {explainer[0]}")

        payload = {"content": "\n".join(content_lines)}
        self._post(self.discord_webhook_url, payload)

    def _post_generic(self, alert: WhaleAlert) -> None:
        payload = {
            "alert": {
                "severity": alert.severity,
                "score": alert.score,
                "threshold_usd": alert.threshold_usd,
                "tags": list(alert.tags),
                "score_breakdown": alert.score_breakdown,
                "enrichment": alert.enrichment,
            },
            "trade": asdict(alert.trade),
        }
        self._post(self.generic_webhook_url, payload)

    def _post(self, url: str | None, payload: dict[str, Any]) -> None:
        if not url:
            return

        response = requests.post(url, json=payload, timeout=self.timeout)
        response.raise_for_status()

    def _signature(self, alert: WhaleAlert) -> str:
        trade = alert.trade
        price_bucket = round(trade.price, 2)
        amount_bucket = round(trade.amount, 4)
        return f"{trade.symbol}|{trade.side}|{trade.cause}|{price_bucket}|{amount_bucket}"
