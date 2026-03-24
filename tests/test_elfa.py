from __future__ import annotations

import unittest
from unittest.mock import patch

from deepsignal.models import Trade, WhaleAlert
from deepsignal.sponsors.elfa import ElfaSignalEnricher


def _build_alert() -> WhaleAlert:
    return WhaleAlert(
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
    )


class ElfaTests(unittest.TestCase):
    def test_disabled_without_api_key(self) -> None:
        enricher = ElfaSignalEnricher(api_key=None)

        result = enricher.enrich(_build_alert())

        self.assertEqual(result.enrichment["elfa_status"], "disabled")
        self.assertEqual(result.enrichment["elfa_symbol"], "BTC")

    @patch("deepsignal.sponsors.elfa.ElfaApiClient")
    def test_live_enrichment_with_api_key(self, client_cls) -> None:
        client = client_cls.return_value
        client.get_top_mentions.return_value = {"data": [{"text": "BTC momentum strong"}]}
        client.get_token_news.return_value = {"data": [{"title": "BTC news"}]}
        client.get_trending_narratives.return_value = {"data": [{"name": "risk-on"}]}

        enricher = ElfaSignalEnricher(api_key="test-key")
        result = enricher.enrich(_build_alert())

        self.assertEqual(result.enrichment["elfa_status"], "live")
        self.assertEqual(result.enrichment["elfa_top_mentions_count"], 1)
        self.assertEqual(result.enrichment["elfa_token_news_count"], 1)
        self.assertEqual(result.enrichment["elfa_trending_narratives_count"], 1)
        self.assertEqual(result.enrichment["elfa_market_signal"], "low-attention")
        self.assertTrue(result.enrichment["elfa_explainer"])


if __name__ == "__main__":
    unittest.main()
