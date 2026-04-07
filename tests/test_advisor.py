from __future__ import annotations

import json
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch

from deepsignal.advisor import DeepSignalAdvisor
from deepsignal.alerting import AlertDispatcher
from deepsignal.models import Trade, WhaleAlert
from deepsignal.storage import DeepSignalStorage


class AdvisorTests(unittest.TestCase):
    @patch("deepsignal.alerting.requests.post")
    def test_send_discord_message_uses_webhook(self, post_mock) -> None:
        dispatcher = AlertDispatcher(
            min_score=60,
            dedup_seconds=90,
            symbol_cooldown_seconds=300,
            summary_threshold=3,
            discord_webhook_url="https://discord.test/webhook",
        )

        response = post_mock.return_value
        response.raise_for_status.return_value = None

        dispatcher.send_discord_message("DeepSignal advisor test")

        post_mock.assert_called_once()
        self.assertEqual(post_mock.call_args.kwargs["json"]["content"], "DeepSignal advisor test")

    def test_build_brief_without_elfa_key(self) -> None:
        base = Path("test-output") / f"advisor-{uuid4().hex}"
        base.mkdir(parents=True, exist_ok=True)
        storage = DeepSignalStorage(base / "deepsignal.db")
        storage.save_whale_alert(
            WhaleAlert(
                trade=Trade(
                    symbol="SOL",
                    price=200,
                    amount=1000,
                    side="open_long",
                    cause="normal",
                    timestamp_ms=1_700_000_000_000,
                    source="ws",
                ),
                threshold_usd=100_000,
                tags=("open_long", "whale"),
                score=91.2,
                enrichment={
                    "elfa_status": "disabled",
                    "elfa_attention_score": 66,
                    "elfa_explainer": ["Mentions: SOL momentum is accelerating"],
                },
            )
        )

        advisor = DeepSignalAdvisor(
            storage,
            elfa_api_key=None,
            elfa_base_url="https://api.elfa.ai",
        )

        brief = advisor.build_brief(lookback_hours=24)

        self.assertEqual(brief["advisor_status"], "ready")
        self.assertEqual(brief["elfa_status"], "disabled")
        self.assertIn("agent_brief", brief)
        self.assertEqual(brief["agent_brief"]["status"], "disabled")
        self.assertEqual(len(brief["signals"]), 1)
        self.assertIn("profiles", brief)
        self.assertIn("prudent", brief["profiles"])
        self.assertIn("balanced", brief["profiles"])
        self.assertIn("aggressive", brief["profiles"])
        self.assertEqual(brief["default_profile"], "balanced")
        self.assertIn("DeepSignal Advisor", brief["discord_messages"][0])

    @patch("deepsignal.advisor.ElfaApiClient")
    def test_export_brief_with_live_elfa_context(self, client_cls) -> None:
        base = Path("test-output") / f"advisor-live-{uuid4().hex}"
        base.mkdir(parents=True, exist_ok=True)
        storage = DeepSignalStorage(base / "deepsignal.db")
        storage.save_whale_alert(
            WhaleAlert(
                trade=Trade(
                    symbol="BTC",
                    price=100_000,
                    amount=2,
                    side="open_long",
                    cause="normal",
                    timestamp_ms=1_700_000_100_000,
                    source="ws",
                ),
                threshold_usd=100_000,
                tags=("open_long", "whale"),
                score=88.0,
                enrichment={
                    "elfa_status": "live",
                    "elfa_attention_score": 82,
                    "elfa_explainer": ["Mentions: BTC breakout momentum is leading the board"],
                },
            )
        )

        client = client_cls.return_value
        client.get_trending_tokens.return_value = {
            "data": [{"ticker": "BTC"}, {"ticker": "SOL"}]
        }
        client.chat.return_value = {
            "data": {
                "message": "BTC leads the board while SOL keeps secondary momentum. Favor confirmation over chasing."
            }
        }

        advisor = DeepSignalAdvisor(
            storage,
            elfa_api_key="test-key",
            elfa_base_url="https://api.elfa.ai",
        )
        output_path = advisor.export_brief(base / "advisor.json", lookback_hours=24)
        payload = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(payload["elfa_status"], "live")
        self.assertTrue(payload["market_summary"]["trending_tokens"])
        self.assertEqual(payload["agent_brief"]["status"], "live")
        self.assertIn("BTC leads the board", payload["agent_brief"]["summary"])
        self.assertTrue(payload["signals"])
        self.assertTrue(payload["profiles"]["balanced"]["signals"])
        self.assertIn("size_hint", payload["profiles"]["prudent"])

    @patch("deepsignal.advisor.ElfaApiClient")
    def test_ask_agent_returns_live_answer(self, client_cls) -> None:
        base = Path("test-output") / f"advisor-chat-{uuid4().hex}"
        base.mkdir(parents=True, exist_ok=True)
        storage = DeepSignalStorage(base / "deepsignal.db")
        storage.save_whale_alert(
            WhaleAlert(
                trade=Trade(
                    symbol="ETH",
                    price=3500,
                    amount=50,
                    side="open_long",
                    cause="normal",
                    timestamp_ms=1_700_000_200_000,
                    source="ws",
                ),
                threshold_usd=100_000,
                tags=("open_long", "whale"),
                score=84.0,
                enrichment={
                    "elfa_status": "live",
                    "elfa_attention_score": 75,
                    "elfa_explainer": ["Mentions: ETH sentiment is improving with steady follow-through"],
                },
            )
        )

        client = client_cls.return_value
        client.get_trending_tokens.return_value = {"data": [{"ticker": "ETH"}]}
        client.chat.return_value = {"data": {"message": "ETH is worth monitoring for continuation, but wait for clean confirmation."}}

        advisor = DeepSignalAdvisor(
            storage,
            elfa_api_key="test-key",
            elfa_base_url="https://api.elfa.ai",
        )

        payload = advisor.ask_agent("Which trend should I focus on?", lookback_hours=24)

        self.assertEqual(payload["status"], "live")
        self.assertIn("ETH is worth monitoring", payload["answer"])
        self.assertIn("DeepSignal ELFA Advisor", payload["discord_ready_message"])


if __name__ == "__main__":
    unittest.main()
