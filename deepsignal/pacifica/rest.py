from __future__ import annotations

from typing import Any

import requests

from deepsignal.models import MarketInfo, Trade


class PacificaRestClient:
    def __init__(self, base_url: str, timeout: int = 15) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def get_market_info(self) -> list[MarketInfo]:
        payload = self._get("/info")
        markets = payload.get("data", [])
        return [
            MarketInfo(
                symbol=market["symbol"],
                tick_size=market["tick_size"],
                lot_size=market["lot_size"],
                max_leverage=int(market["max_leverage"]),
                funding_rate=market["funding_rate"],
                next_funding_rate=market["next_funding_rate"],
            )
            for market in markets
        ]

    def get_recent_trades(self, symbol: str) -> list[Trade]:
        payload = self._get("/trades", params={"symbol": symbol})
        trades = payload.get("data", [])
        last_order_id = payload.get("last_order_id")
        return [
            Trade(
                symbol=symbol,
                price=float(trade["price"]),
                amount=float(trade["amount"]),
                side=trade["side"],
                cause=trade["cause"],
                timestamp_ms=int(trade["created_at"]),
                sequence_id=int(last_order_id) if last_order_id is not None else None,
                source="rest",
            )
            for trade in trades
        ]

    def get_account_info(self, account: str) -> dict[str, Any]:
        payload = self._get("/account", params={"account": account})
        return payload.get("data", {})

    def get_account_balance_history(
        self,
        account: str,
        *,
        limit: int = 100,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"account": account, "limit": limit}
        if cursor:
            params["cursor"] = cursor
        return self._get("/account/balance/history", params=params)

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = requests.get(
                f"{self.base_url}{path}",
                params=params,
                headers={"Accept": "application/json"},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise RuntimeError(
                f"Failed to reach Pacifica REST API at {self.base_url}{path}: {exc}"
            ) from exc
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success", False):
            raise RuntimeError(
                f"Pacifica API returned an error for {path}: {payload.get('error')}"
            )
        return payload
