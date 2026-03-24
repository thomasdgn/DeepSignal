from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_MAINNET_REST_URL = "https://api.pacifica.fi/api/v1"
DEFAULT_MAINNET_WS_URL = "wss://ws.pacifica.fi/ws"
DEFAULT_TESTNET_REST_URL = "https://test-api.pacifica.fi/api/v1"
DEFAULT_TESTNET_WS_URL = "wss://test-ws.pacifica.fi/ws"


@dataclass(frozen=True)
class Settings:
    pacifica_env: str
    pacifica_rest_url: str
    pacifica_ws_url: str
    pacifica_account: str | None
    pacifica_private_key: str | None
    pacifica_symbols: list[str]
    whale_notional_usd: float
    data_dir: Path
    database_path: Path
    reports_dir: Path
    watchlist_path: Path
    elfa_base_url: str
    elfa_api_key: str | None
    alert_min_score: float
    alert_dedup_seconds: int
    alert_symbol_cooldown_seconds: int
    alert_summary_threshold: int
    discord_webhook_url: str | None
    generic_alert_webhook_url: str | None


def load_settings() -> Settings:
    _load_dotenv()
    pacifica_env = os.getenv("PACIFICA_ENV", "testnet").strip().lower()
    default_rest_url, default_ws_url = _default_urls_for_env(pacifica_env)

    raw_symbols = os.getenv("PACIFICA_SYMBOLS", "BTC,ETH,SOL")
    symbols = [symbol.strip() for symbol in raw_symbols.split(",") if symbol.strip()]
    if not symbols:
        raise ValueError("PACIFICA_SYMBOLS must include at least one symbol")

    return Settings(
        pacifica_env=pacifica_env,
        pacifica_rest_url=_env_with_default("PACIFICA_REST_URL", default_rest_url),
        pacifica_ws_url=_env_with_default("PACIFICA_WS_URL", default_ws_url),
        pacifica_account=_optional_env("PACIFICA_ACCOUNT"),
        pacifica_private_key=_optional_env("PACIFICA_PRIVATE_KEY"),
        pacifica_symbols=symbols,
        whale_notional_usd=float(os.getenv("WHALE_NOTIONAL_USD", "100000")),
        data_dir=Path(_env_with_default("DEEPSIGNAL_DATA_DIR", "data")),
        database_path=Path(_env_with_default("DEEPSIGNAL_DB_PATH", "data/deepsignal.db")),
        reports_dir=Path(_env_with_default("DEEPSIGNAL_REPORTS_DIR", "reports")),
        watchlist_path=Path(_env_with_default("DEEPSIGNAL_WATCHLIST_PATH", "watchlist.local.json")),
        elfa_base_url=_env_with_default("ELFA_BASE_URL", "https://api.elfa.ai"),
        elfa_api_key=_optional_env("ELFA_API_KEY"),
        alert_min_score=float(os.getenv("ALERT_MIN_SCORE", "60")),
        alert_dedup_seconds=int(os.getenv("ALERT_DEDUP_SECONDS", "90")),
        alert_symbol_cooldown_seconds=int(os.getenv("ALERT_SYMBOL_COOLDOWN_SECONDS", "300")),
        alert_summary_threshold=int(os.getenv("ALERT_SUMMARY_THRESHOLD", "3")),
        discord_webhook_url=_optional_env("DISCORD_WEBHOOK_URL"),
        generic_alert_webhook_url=_optional_env("GENERIC_ALERT_WEBHOOK_URL"),
    )


def _default_urls_for_env(environment: str) -> tuple[str, str]:
    if environment == "mainnet":
        return DEFAULT_MAINNET_REST_URL, DEFAULT_MAINNET_WS_URL
    return DEFAULT_TESTNET_REST_URL, DEFAULT_TESTNET_WS_URL


def _optional_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def _env_with_default(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


def _load_dotenv(path: str = ".env") -> None:
    dotenv_path = Path(path)
    if not dotenv_path.exists():
        return

    for line in dotenv_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())
