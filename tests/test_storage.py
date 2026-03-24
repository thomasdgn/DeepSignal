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
                enrichment={"elfa_status": "disabled"},
            )
            storage.save_whale_alert(alert)
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

            self.assertEqual(dashboard_data["total_alerts"], 1)
            self.assertEqual(len(dashboard_data["watchlist_accounts"]), 1)
            self.assertTrue(report_path.exists())
            self.assertIn("DeepSignal Whale Dashboard", report_path.read_text(encoding="utf-8"))
        finally:
            if base.exists():
                shutil.rmtree(base)


if __name__ == "__main__":
    unittest.main()
