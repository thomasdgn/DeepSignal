from __future__ import annotations

from deepsignal.pacifica.rest import PacificaRestClient
from deepsignal.storage import DeepSignalStorage
from deepsignal.watchlist import WatchlistEntry


class AccountAnalysisService:
    def __init__(self, rest_client: PacificaRestClient, storage: DeepSignalStorage) -> None:
        self.rest_client = rest_client
        self.storage = storage

    def sync_watchlist(self, watchlist: list[WatchlistEntry]) -> int:
        synced = 0
        for entry in watchlist:
            try:
                account_payload = self.rest_client.get_account_info(entry.address)
                balance_history_payload = self.rest_client.get_account_balance_history(entry.address)
            except Exception as exc:
                print(f"Skipping watchlist account {entry.label} ({entry.address}): {exc}")
                continue

            self.storage.save_account_snapshot(entry, account_payload, balance_history_payload)
            synced += 1
        return synced
