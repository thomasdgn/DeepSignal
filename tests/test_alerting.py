from __future__ import annotations

import unittest
from unittest.mock import patch

from deepsignal.alerting import AlertDispatcher
from deepsignal.models import Trade, WhaleAlert


def _build_alert(
    *,
    score: float = 72.5,
    timestamp_ms: int = 1_700_000_000_000,
    symbol: str = "BTC",
    side: str = "open_long",
) -> WhaleAlert:
    return WhaleAlert(
        trade=Trade(
            symbol=symbol,
            price=100_000,
            amount=2,
            side=side,
            cause="normal",
            timestamp_ms=timestamp_ms,
            source="ws",
        ),
        threshold_usd=100_000,
        tags=(side, "whale"),
        score=score,
        score_breakdown={"multiple_of_threshold": 2.0},
        enrichment={"elfa_market_signal": "rising-attention", "elfa_explainer": ["Mentions: BTC momentum strong"]},
    )


class AlertingTests(unittest.TestCase):
    @patch("deepsignal.alerting.requests.post")
    def test_dispatches_to_configured_channels(self, post_mock) -> None:
        post_mock.return_value.raise_for_status.return_value = None
        dispatcher = AlertDispatcher(
            min_score=60,
            dedup_seconds=90,
            symbol_cooldown_seconds=300,
            summary_threshold=3,
            discord_webhook_url="https://discord.test/webhook",
            generic_webhook_url="https://alerts.test/webhook",
        )

        result = dispatcher.dispatch(_build_alert())

        self.assertEqual(result.delivered, ["discord", "generic-webhook"])
        self.assertEqual(post_mock.call_count, 2)

    @patch("deepsignal.alerting.requests.post")
    def test_skips_low_score_alerts(self, post_mock) -> None:
        dispatcher = AlertDispatcher(
            min_score=80,
            dedup_seconds=90,
            symbol_cooldown_seconds=300,
            summary_threshold=3,
            discord_webhook_url="https://discord.test/webhook",
        )

        result = dispatcher.dispatch(_build_alert(score=50))

        self.assertEqual(result.delivered, [])
        self.assertEqual(result.skipped_reason, "below-min-score")
        post_mock.assert_not_called()

    @patch("deepsignal.alerting.requests.post")
    def test_deduplicates_near_identical_alerts(self, post_mock) -> None:
        post_mock.return_value.raise_for_status.return_value = None
        dispatcher = AlertDispatcher(
            min_score=60,
            dedup_seconds=90,
            symbol_cooldown_seconds=300,
            summary_threshold=3,
            discord_webhook_url="https://discord.test/webhook",
        )

        first = dispatcher.dispatch(_build_alert(timestamp_ms=1_700_000_000_000))
        second = dispatcher.dispatch(_build_alert(timestamp_ms=1_700_000_030_000))

        self.assertEqual(first.delivered, ["discord"])
        self.assertEqual(second.delivered, [])
        self.assertEqual(second.skipped_reason, "deduplicated")
        self.assertEqual(post_mock.call_count, 1)

    @patch("deepsignal.alerting.requests.post")
    def test_emits_summary_after_cooldown_suppression(self, post_mock) -> None:
        post_mock.return_value.raise_for_status.return_value = None
        dispatcher = AlertDispatcher(
            min_score=60,
            dedup_seconds=1,
            symbol_cooldown_seconds=300,
            summary_threshold=2,
            discord_webhook_url="https://discord.test/webhook",
        )

        first = dispatcher.dispatch(_build_alert(timestamp_ms=1_700_000_000_000, side="open_long"))
        second = dispatcher.dispatch(_build_alert(timestamp_ms=1_700_000_050_000, side="open_short"))
        third = dispatcher.dispatch(_build_alert(timestamp_ms=1_700_000_100_000, side="close_short"))

        self.assertEqual(first.delivered, ["discord"])
        self.assertEqual(second.delivered, [])
        self.assertEqual(second.skipped_reason, "symbol-cooldown")
        self.assertEqual(third.delivered, ["discord"])
        self.assertEqual(third.skipped_reason, "cooldown-summary")
        self.assertTrue(third.summary_emitted)
        self.assertEqual(post_mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
