from __future__ import annotations

import unittest

from deepsignal.demo import build_demo_alerts


class DemoTests(unittest.TestCase):
    def test_build_demo_alerts_returns_populated_dataset(self) -> None:
        alerts = build_demo_alerts(100_000)

        self.assertEqual(len(alerts), 12)
        self.assertTrue(all(alert.score > 0 for alert in alerts))
        self.assertTrue(all(alert.enrichment.get("elfa_status") == "demo" for alert in alerts))
        self.assertGreater(sum(alert.trade.notional_usd for alert in alerts), 0)


if __name__ == "__main__":
    unittest.main()
