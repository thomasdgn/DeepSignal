from __future__ import annotations

import unittest
from pathlib import Path
import shutil

from deepsignal.models import Trade, WhaleAlert
from deepsignal.reporting import render_dashboard_report
from deepsignal.storage import DeepSignalStorage
from deepsignal.watchlist import WatchlistEntry


class StorageTests(unittest.TestCase):
    def test_save_alert_and_render_dashboard(self) -> None:
        base = Path("test-output")
        if base.exists():
            shutil.rmtree(base)
        base.mkdir(parents=True)

        try:
            storage = DeepSignalStorage(base / "deepsignal.db")

            alert = WhaleAlert(
                trade=Trade(
                    symbol="BTC",
                    price=100_000,
                    amount=2,
                    side="open_long",
                    cause="normal",
                    timestamp_ms=1_700_000_000_000,
                    source="ws",
                ),
                threshold_usd=100_000,
                tags=("open_long", "whale"),
                score=63.5,
                score_breakdown={"multiple_of_threshold": 2.0, "size_score": 48.5, "side_bonus": 8.0},
                enrichment={
                    "elfa_status": "live",
                    "elfa_market_signal": "rising-attention",
                    "elfa_attention_score": 44.0,
                    "elfa_explainer": ["Mentions: BTC momentum strong", "Narratives: risk-on"],
                },
            )
            storage.save_whale_alert(alert)
            storage.save_whale_alert(
                WhaleAlert(
                    trade=Trade(
                        symbol="ETH",
                        price=3_000,
                        amount=80,
                        side="open_short",
                        cause="normal",
                        timestamp_ms=1_700_000_100_000,
                        source="ws",
                    ),
                    threshold_usd=100_000,
                    tags=("open_short", "whale"),
                    score=71.0,
                    score_breakdown={
                        "multiple_of_threshold": 2.4,
                        "size_score": 55.0,
                        "side_bonus": 8.0,
                    },
                    enrichment={
                        "elfa_status": "live",
                        "elfa_market_signal": "high-attention",
                        "elfa_attention_score": 76.0,
                        "elfa_explainer": ["Mentions: ETH volatility", "News: ETH derivatives active"],
                    },
                )
            )
            storage.save_account_snapshot(
                WatchlistEntry(label="fund-a", address="abc123"),
                {
                    "account_equity": "1200",
                    "balance": "500",
                    "orders_count": "3",
                    "timestamp": 1700000000000,
                },
                {"data": []},
            )

            dashboard_data = storage.get_dashboard_data()
            report_path = render_dashboard_report(base / "dashboard.html", dashboard_data)

            self.assertEqual(dashboard_data["total_alerts"], 2)
            self.assertEqual(len(dashboard_data["ranked_alerts"]), 2)
            self.assertEqual(len(dashboard_data["narrative_summary"]), 2)
            self.assertGreater(dashboard_data["highest_score"], 0)
            self.assertEqual(len(dashboard_data["hot_symbols"]), 2)
            self.assertEqual(len(dashboard_data["directional_flow"]), 2)
            self.assertEqual(len(dashboard_data["pressure_split"]), 2)
            self.assertEqual(len(dashboard_data["watchlist_accounts"]), 1)
            self.assertTrue(report_path.exists())
            self.assertIn("DeepSignal Whale Dashboard", report_path.read_text(encoding="utf-8"))
            self.assertIn("Narrative Explainer", report_path.read_text(encoding="utf-8"))
            self.assertIn("Directional Flow", report_path.read_text(encoding="utf-8"))
        finally:
            if base.exists():
                shutil.rmtree(base)


if __name__ == "__main__":
    unittest.main()
