from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import websockets

from deepsignal.models import Trade


class PacificaWebsocketClient:
    def __init__(self, ws_url: str) -> None:
        self.ws_url = ws_url

    async def stream_trades(self, symbols: list[str]) -> AsyncIterator[Trade]:
        async with websockets.connect(self.ws_url) as websocket:
            for symbol in symbols:
                await websocket.send(
                    json.dumps(
                        {
                            "method": "subscribe",
                            "params": {"source": "trades", "symbol": symbol},
                        }
                    )
                )

            while True:
                message = await websocket.recv()
                for trade in _parse_trade_message(message):
                    yield trade
                await asyncio.sleep(0)


def _parse_trade_message(message: str) -> list[Trade]:
    payload = json.loads(message)
    if payload.get("channel") != "trades":
        return []

    trades = payload.get("data", [])
    parsed_trades: list[Trade] = []
    for trade in trades:
        parsed_trades.append(
            Trade(
                symbol=trade["s"],
                price=float(trade["p"]),
                amount=float(trade["a"]),
                side=trade["d"],
                cause=trade["tc"],
                timestamp_ms=int(trade["t"]),
                sequence_id=int(trade["li"]) if trade.get("li") is not None else None,
                source="ws",
            )
        )
    return parsed_trades
