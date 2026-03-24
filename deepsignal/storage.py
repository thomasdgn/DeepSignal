from __future__ import annotations

from contextlib import closing
import json
import sqlite3
from pathlib import Path
from typing import Any

from deepsignal.models import WhaleAlert
from deepsignal.watchlist import WatchlistEntry


class DeepSignalStorage:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def save_whale_alert(self, alert: WhaleAlert) -> None:
        trade = alert.trade
        with closing(self._connect()) as connection:
            connection.execute(
                """
                INSERT INTO whale_alerts (
                    symbol, price, amount, notional_usd, side, cause, timestamp_ms,
                    sequence_id, source, threshold_usd, severity, score, tags_json,
                    score_breakdown_json, enrichment_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade.symbol,
                    trade.price,
                    trade.amount,
                    trade.notional_usd,
                    trade.side,
                    trade.cause,
                    trade.timestamp_ms,
                    trade.sequence_id,
                    trade.source,
                    alert.threshold_usd,
                    alert.severity,
                    alert.score,
                    json.dumps(list(alert.tags)),
                    json.dumps(alert.score_breakdown),
                    json.dumps(alert.enrichment),
                ),
            )
            connection.commit()

    def save_account_snapshot(
        self,
        watchlist_entry: WatchlistEntry,
        account_payload: dict[str, Any],
        balance_history_payload: dict[str, Any],
    ) -> None:
        with closing(self._connect()) as connection:
            connection.execute(
                """
                INSERT INTO account_snapshots (
                    account_address, label, snapshot_timestamp_ms, equity, balance,
                    orders_count, raw_account_json, raw_balance_history_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    watchlist_entry.address,
                    watchlist_entry.label,
                    _extract_snapshot_timestamp_ms(account_payload),
                    _optional_float(account_payload, ("account_equity", "equity")),
                    _optional_float(account_payload, ("balance",)),
                    _optional_int(account_payload, ("orders_count",)),
                    json.dumps(account_payload),
                    json.dumps(balance_history_payload),
                ),
            )
            connection.commit()

    def clear_whale_alerts(self) -> None:
        with closing(self._connect()) as connection:
            connection.execute("DELETE FROM whale_alerts")
            connection.commit()

    def get_dashboard_data(self, lookback_hours: int = 24) -> dict[str, Any]:
        lookback_ms = lookback_hours * 60 * 60 * 1000
        with closing(self._connect()) as connection:
            latest_timestamp = connection.execute(
                "SELECT COALESCE(MAX(timestamp_ms), 0) FROM whale_alerts"
            ).fetchone()[0]
            window_start = max(int(latest_timestamp) - lookback_ms, 0)

            totals = connection.execute(
                """
                SELECT
                    COUNT(*),
                    COALESCE(SUM(notional_usd), 0),
                    COALESCE(MAX(notional_usd), 0),
                    COALESCE(MAX(score), 0)
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                """,
                (window_start,),
            ).fetchone()

            top_symbols = connection.execute(
                """
                SELECT
                    symbol,
                    COUNT(*) AS event_count,
                    ROUND(SUM(notional_usd), 2) AS total_notional,
                    ROUND(AVG(score), 2) AS avg_score,
                    ROUND(MAX(score), 2) AS max_score
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY symbol
                ORDER BY max_score DESC, total_notional DESC, event_count DESC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            side_breakdown = connection.execute(
                """
                SELECT side, COUNT(*) AS event_count, ROUND(SUM(notional_usd), 2) AS total_notional
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY side
                ORDER BY total_notional DESC
                """,
                (window_start,),
            ).fetchall()

            recent_alerts = connection.execute(
                """
                SELECT symbol, side, severity, ROUND(notional_usd, 2), timestamp_ms, tags_json
                FROM whale_alerts
                ORDER BY timestamp_ms DESC
                LIMIT 20
                """
            ).fetchall()

            ranked_alerts = connection.execute(
                """
                SELECT
                    symbol,
                    side,
                    severity,
                    ROUND(notional_usd, 2),
                    ROUND(score, 2),
                    timestamp_ms,
                    tags_json,
                    score_breakdown_json,
                    enrichment_json
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                ORDER BY score DESC, notional_usd DESC, timestamp_ms DESC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            timeline = connection.execute(
                """
                SELECT
                    (timestamp_ms / 3600000) * 3600000 AS bucket_start_ms,
                    COUNT(*) AS event_count,
                    ROUND(SUM(notional_usd), 2) AS total_notional,
                    ROUND(MAX(score), 2) AS max_score
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY bucket_start_ms
                ORDER BY bucket_start_ms DESC
                LIMIT 12
                """,
                (window_start,),
            ).fetchall()

            narrative_summary = connection.execute(
                """
                SELECT
                    symbol,
                    ROUND(AVG(score), 2) AS avg_score,
                    COUNT(*) AS event_count,
                    ROUND(AVG(
                        CASE
                            WHEN json_valid(enrichment_json)
                            THEN COALESCE(json_extract(enrichment_json, '$.elfa_attention_score'), 0)
                            ELSE 0
                        END
                    ), 2) AS avg_attention_score,
                    MAX(
                        CASE
                            WHEN json_valid(enrichment_json)
                            THEN COALESCE(json_extract(enrichment_json, '$.elfa_market_signal'), '')
                            ELSE ''
                        END
                    ) AS market_signal
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY symbol
                ORDER BY avg_attention_score DESC, avg_score DESC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            directional_flow = connection.execute(
                """
                SELECT
                    symbol,
                    ROUND(SUM(
                        CASE
                            WHEN LOWER(side) IN ('open_long', 'close_short') THEN notional_usd
                            ELSE 0
                        END
                    ), 2) AS bullish_notional,
                    ROUND(SUM(
                        CASE
                            WHEN LOWER(side) IN ('open_short', 'close_long') THEN notional_usd
                            ELSE 0
                        END
                    ), 2) AS bearish_notional,
                    ROUND(SUM(
                        CASE
                            WHEN LOWER(side) IN ('open_long', 'close_short') THEN notional_usd
                            WHEN LOWER(side) IN ('open_short', 'close_long') THEN -notional_usd
                            ELSE 0
                        END
                    ), 2) AS net_flow,
                    ROUND(MAX(score), 2) AS max_score
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY symbol
                ORDER BY ABS(net_flow) DESC, max_score DESC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            pressure_split = connection.execute(
                """
                SELECT
                    symbol,
                    ROUND(SUM(CASE WHEN LOWER(side) = 'open_long' THEN notional_usd ELSE 0 END), 2),
                    ROUND(SUM(CASE WHEN LOWER(side) = 'open_short' THEN notional_usd ELSE 0 END), 2),
                    ROUND(SUM(CASE WHEN LOWER(side) = 'close_long' THEN notional_usd ELSE 0 END), 2),
                    ROUND(SUM(CASE WHEN LOWER(side) = 'close_short' THEN notional_usd ELSE 0 END), 2)
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY symbol
                ORDER BY symbol ASC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            hot_symbols = connection.execute(
                """
                SELECT
                    symbol,
                    COUNT(*) AS event_count,
                    ROUND(AVG(score), 2) AS avg_score,
                    ROUND(MAX(score), 2) AS max_score,
                    ROUND(AVG(
                        CASE
                            WHEN json_valid(enrichment_json)
                            THEN COALESCE(json_extract(enrichment_json, '$.elfa_attention_score'), 0)
                            ELSE 0
                        END
                    ), 2) AS avg_attention_score,
                    ROUND(
                        (AVG(score) * 0.65)
                        + (
                            AVG(
                                CASE
                                    WHEN json_valid(enrichment_json)
                                    THEN COALESCE(json_extract(enrichment_json, '$.elfa_attention_score'), 0)
                                    ELSE 0
                                END
                            ) * 0.35
                        )
                        + (COUNT(*) * 2.5),
                        2
                    ) AS hot_score
                FROM whale_alerts
                WHERE timestamp_ms >= ?
                GROUP BY symbol
                ORDER BY hot_score DESC, max_score DESC
                LIMIT 10
                """,
                (window_start,),
            ).fetchall()

            watchlist = connection.execute(
                """
                SELECT
                    account_address,
                    label,
                    MAX(snapshot_timestamp_ms) AS latest_snapshot_ms,
                    MAX(COALESCE(equity, 0)) AS max_equity,
                    MAX(COALESCE(balance, 0)) AS max_balance,
                    COUNT(*) AS snapshot_count
                FROM account_snapshots
                GROUP BY account_address, label
                ORDER BY latest_snapshot_ms DESC
                """
            ).fetchall()

        return {
            "lookback_hours": lookback_hours,
            "window_start_ms": window_start,
            "latest_timestamp_ms": int(latest_timestamp),
            "total_alerts": int(totals[0]),
            "total_notional_usd": float(totals[1]),
            "largest_alert_usd": float(totals[2]),
            "highest_score": float(totals[3]),
            "top_symbols": [
                {
                    "symbol": row[0],
                    "event_count": int(row[1]),
                    "total_notional_usd": float(row[2]),
                    "avg_score": float(row[3]),
                    "max_score": float(row[4]),
                }
                for row in top_symbols
            ],
            "side_breakdown": [
                {"side": row[0], "event_count": int(row[1]), "total_notional_usd": float(row[2])}
                for row in side_breakdown
            ],
            "recent_alerts": [
                {
                    "symbol": row[0],
                    "side": row[1],
                    "severity": row[2],
                    "notional_usd": float(row[3]),
                    "timestamp_ms": int(row[4]),
                    "tags": json.loads(row[5] or "[]"),
                }
                for row in recent_alerts
            ],
            "ranked_alerts": [
                {
                    "symbol": row[0],
                    "side": row[1],
                    "severity": row[2],
                    "notional_usd": float(row[3]),
                    "score": float(row[4]),
                    "timestamp_ms": int(row[5]),
                    "tags": json.loads(row[6] or "[]"),
                    "score_breakdown": json.loads(row[7] or "{}"),
                    "enrichment": json.loads(row[8] or "{}"),
                }
                for row in ranked_alerts
            ],
            "timeline": [
                {
                    "bucket_start_ms": int(row[0]),
                    "event_count": int(row[1]),
                    "total_notional_usd": float(row[2]),
                    "max_score": float(row[3]),
                }
                for row in timeline
            ],
            "narrative_summary": [
                {
                    "symbol": row[0],
                    "avg_score": float(row[1]),
                    "event_count": int(row[2]),
                    "avg_attention_score": float(row[3] or 0),
                    "market_signal": row[4] or "n/a",
                }
                for row in narrative_summary
            ],
            "directional_flow": [
                {
                    "symbol": row[0],
                    "bullish_notional_usd": float(row[1]),
                    "bearish_notional_usd": float(row[2]),
                    "net_flow_usd": float(row[3]),
                    "max_score": float(row[4]),
                }
                for row in directional_flow
            ],
            "pressure_split": [
                {
                    "symbol": row[0],
                    "open_long_usd": float(row[1]),
                    "open_short_usd": float(row[2]),
                    "close_long_usd": float(row[3]),
                    "close_short_usd": float(row[4]),
                }
                for row in pressure_split
            ],
            "hot_symbols": [
                {
                    "symbol": row[0],
                    "event_count": int(row[1]),
                    "avg_score": float(row[2]),
                    "max_score": float(row[3]),
                    "avg_attention_score": float(row[4]),
                    "hot_score": float(row[5]),
                }
                for row in hot_symbols
            ],
            "watchlist_accounts": [
                {
                    "account_address": row[0],
                    "label": row[1],
                    "latest_snapshot_ms": int(row[2] or 0),
                    "max_equity": float(row[3] or 0),
                    "max_balance": float(row[4] or 0),
                    "snapshot_count": int(row[5]),
                }
                for row in watchlist
            ],
        }

    def _initialize(self) -> None:
        with closing(self._connect()) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS whale_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    price REAL NOT NULL,
                    amount REAL NOT NULL,
                    notional_usd REAL NOT NULL,
                    side TEXT NOT NULL,
                    cause TEXT NOT NULL,
                    timestamp_ms INTEGER NOT NULL,
                    sequence_id INTEGER,
                    source TEXT NOT NULL,
                    threshold_usd REAL NOT NULL,
                    severity TEXT NOT NULL,
                    score REAL NOT NULL DEFAULT 0,
                    tags_json TEXT NOT NULL,
                    score_breakdown_json TEXT NOT NULL DEFAULT '{}',
                    enrichment_json TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS account_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_address TEXT NOT NULL,
                    label TEXT NOT NULL,
                    snapshot_timestamp_ms INTEGER NOT NULL,
                    equity REAL,
                    balance REAL,
                    orders_count INTEGER,
                    raw_account_json TEXT NOT NULL,
                    raw_balance_history_json TEXT NOT NULL
                )
                """
            )
            self._ensure_column(connection, "whale_alerts", "score", "REAL NOT NULL DEFAULT 0")
            self._ensure_column(
                connection,
                "whale_alerts",
                "score_breakdown_json",
                "TEXT NOT NULL DEFAULT '{}'",
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path)

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table: str,
        column: str,
        definition: str,
    ) -> None:
        columns = {
            row[1]
            for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _optional_float(payload: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = payload.get(key)
        if value is not None and value != "":
            return float(value)
    return None


def _optional_int(payload: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        value = payload.get(key)
        if value is not None and value != "":
            return int(value)
    return None


def _extract_snapshot_timestamp_ms(payload: dict[str, Any]) -> int:
    for key in ("timestamp", "updated_at", "created_at"):
        value = payload.get(key)
        if value is not None and value != "":
            return int(value)
    return 0
