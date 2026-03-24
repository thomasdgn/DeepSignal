import unittest

from deepsignal.detection import WhaleDetector
from deepsignal.models import Trade


class WhaleDetectorTests(unittest.TestCase):
    def test_returns_alert_for_large_trade(self) -> None:
        detector = WhaleDetector(threshold_usd=100_000)
        trade = Trade(
            symbol="BTC",
            price=100_000,
            amount=1.5,
            side="open_long",
            cause="normal",
            timestamp_ms=1_700_000_000_000,
        )

        alert = detector.evaluate(trade)

        self.assertIsNotNone(alert)
        assert alert is not None
        self.assertEqual(alert.severity, "medium")
        self.assertIn("open_long", alert.tags)

    def test_ignores_small_trade(self) -> None:
        detector = WhaleDetector(threshold_usd=100_000)
        trade = Trade(
            symbol="ETH",
            price=2_500,
            amount=3,
            side="close_short",
            cause="normal",
            timestamp_ms=1_700_000_000_000,
        )

        alert = detector.evaluate(trade)

        self.assertIsNone(alert)


if __name__ == "__main__":
    unittest.main()
