from __future__ import annotations

import argparse
import asyncio

from deepsignal.app import DeepSignalApp
from deepsignal.config import load_settings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="DeepSignal whale watcher")
    parser.add_argument(
        "--lookback-hours",
        type=int,
        default=24,
        help="used by the dashboard command",
    )
    parser.add_argument(
        "command",
        choices=("bootstrap", "monitor", "sync-watchlist", "dashboard"),
        help=(
            "bootstrap prints current Pacifica market context, monitor streams whale alerts, "
            "sync-watchlist stores tracked account snapshots, dashboard generates a local HTML report"
        ),
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    settings = load_settings()
    app = DeepSignalApp(settings)

    if args.command == "bootstrap":
        app.print_bootstrap_snapshot()
        return

    if args.command == "sync-watchlist":
        synced = app.sync_watchlist_accounts()
        print(f"Synced {synced} watchlist account(s)")
        return

    if args.command == "dashboard":
        report_path = app.generate_dashboard(lookback_hours=args.lookback_hours)
        print(f"Dashboard generated at {report_path}")
        return

    asyncio.run(app.run_trade_monitor())


if __name__ == "__main__":
    main()
