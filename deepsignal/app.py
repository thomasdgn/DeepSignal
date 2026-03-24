from __future__ import annotations

import asyncio
from pathlib import Path

from deepsignal.account_analysis import AccountAnalysisService
from deepsignal.config import Settings
from deepsignal.detection import WhaleDetector
from deepsignal.models import WhaleAlert
from deepsignal.pacifica import PacificaRestClient, PacificaWebsocketClient
from deepsignal.reporting import render_dashboard_report
from deepsignal.sponsors import ElfaSignalEnricher
from deepsignal.storage import DeepSignalStorage
from deepsignal.watchlist import WatchlistEntry, load_watchlist


class DeepSignalApp:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings.reports_dir.mkdir(parents=True, exist_ok=True)
        self.rest_client = PacificaRestClient(settings.pacifica_rest_url)
        self.ws_client = PacificaWebsocketClient(settings.pacifica_ws_url)
        self.detector = WhaleDetector(settings.whale_notional_usd)
        self.elfa = ElfaSignalEnricher(settings.elfa_api_key, settings.elfa_base_url)
        self.storage = DeepSignalStorage(settings.database_path)
        self.account_analysis = AccountAnalysisService(self.rest_client, self.storage)

    def print_bootstrap_snapshot(self) -> None:
        markets = self.rest_client.get_market_info()
        tracked = [market for market in markets if market.symbol in self.settings.pacifica_symbols]
        print("DeepSignal bootstrap")
        print(f"Environment: {self.settings.pacifica_env}")
        print(f"Tracked symbols: {', '.join(self.settings.pacifica_symbols)}")
        print(f"Whale threshold: ${self.settings.whale_notional_usd:,.0f}")
        print("Markets:")
        for market in tracked:
            print(
                f" - {market.symbol}: tick={market.tick_size}, lot={market.lot_size}, "
                f"max_leverage={market.max_leverage}, funding={market.next_funding_rate}"
            )

        if self.settings.pacifica_account:
            try:
                account = self.rest_client.get_account_info(self.settings.pacifica_account)
            except Exception as exc:
                print(f"Tracked account snapshot unavailable: {exc}")
            else:
                print("Tracked account snapshot:")
                print(
                    f" - equity={account.get('account_equity')} "
                    f"balance={account.get('balance')} orders={account.get('orders_count')}"
                )

    async def run_trade_monitor(self) -> None:
        async for trade in self.ws_client.stream_trades(self.settings.pacifica_symbols):
            alert = self.detector.evaluate(trade)
            if alert is None:
                continue

            enriched = self.elfa.enrich(alert)
            self.storage.save_whale_alert(enriched)
            self._print_alert(enriched)
            await asyncio.sleep(0)

    def sync_watchlist_accounts(self) -> int:
        watchlist = self.load_watchlist()
        if not watchlist and self.settings.pacifica_account:
            watchlist = [WatchlistEntry(label="primary-account", address=self.settings.pacifica_account)]
        if not watchlist:
            print(
                "No valid watchlist accounts found. Replace the sample address in "
                f"{self.settings.watchlist_path} or set PACIFICA_ACCOUNT in .env."
            )
            return 0
        return self.account_analysis.sync_watchlist(watchlist)

    def generate_dashboard(self, lookback_hours: int = 24) -> Path:
        dashboard_data = self.storage.get_dashboard_data(lookback_hours=lookback_hours)
        report_path = self.settings.reports_dir / "dashboard.html"
        return render_dashboard_report(report_path, dashboard_data)

    def load_watchlist(self) -> list[WatchlistEntry]:
        return load_watchlist(self.settings.watchlist_path)

    def _print_alert(self, alert: WhaleAlert) -> None:
        trade = alert.trade
        tags = ", ".join(alert.tags) if alert.tags else "none"
        print(
            f"[{alert.severity.upper()}] {trade.symbol} "
            f"{trade.side} ${trade.notional_usd:,.2f} "
            f"at {trade.timestamp.isoformat()} tags={tags}"
        )
        if alert.enrichment:
            print(f"  enrichment={alert.enrichment}")
