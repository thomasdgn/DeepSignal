from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class WatchlistEntry:
    label: str
    address: str


def load_watchlist(path: Path) -> list[WatchlistEntry]:
    if not path.exists():
        return []

    payload = json.loads(path.read_text(encoding="utf-8"))
    entries = payload.get("accounts", [])
    return [
        WatchlistEntry(
            label=str(entry.get("label", entry.get("address", "unknown"))),
            address=str(entry["address"]),
        )
        for entry in entries
        if entry.get("address") and entry.get("address") != "replace-with-pacifica-account"
    ]
