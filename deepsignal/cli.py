from __future__ import annotations

import argparse
import asyncio

from deepsignal.api_server import serve_api
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
        "--port",
        type=int,
        default=8765,
        help="used by the serve-api command",
    )
    parser.add_argument(
        "command",
        choices=(
            "bootstrap",
            "monitor",
            "sync-watchlist",
            "dashboard",
            "advisor",
            "seed-demo",
            "demo-dashboard",
            "export-terminal",
            "serve-api",
        ),
        help=(
            "bootstrap prints current Pacifica market context, monitor streams whale alerts, "
            "sync-watchlist stores tracked account snapshots, dashboard generates a local HTML report, "
            "advisor generates a backend advisor brief with recommendations and Discord-ready messages, "
            "seed-demo writes deterministic demo alerts into the local database, "
            "demo-dashboard seeds demo data and rebuilds the dashboard in one step, "
            "export-terminal writes frontend/public/terminal-data.json for the React terminal, "
            "serve-api starts a small local API for frontend advisor chat"
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
        export_path = app.export_terminal_data(lookback_hours=args.lookback_hours)
        print(f"Dashboard generated at {report_path}")
        print(f"Terminal data exported to {export_path}")
        return

    if args.command == "advisor":
        advisor_path = app.export_advisor_brief(lookback_hours=args.lookback_hours)
        print(f"Advisor brief exported to {advisor_path}")
        return

    if args.command == "seed-demo":
        seeded = app.seed_demo_data()
        print(f"Seeded {seeded} demo whale alert(s)")
        return

    if args.command == "demo-dashboard":
        seeded, report_path = app.build_demo_dashboard(lookback_hours=args.lookback_hours)
        export_path = app.export_terminal_data(lookback_hours=args.lookback_hours)
        print(f"Seeded {seeded} demo whale alert(s)")
        print(f"Dashboard generated at {report_path}")
        print(f"Terminal data exported to {export_path}")
        return

    if args.command == "export-terminal":
        export_path = app.export_terminal_data(lookback_hours=args.lookback_hours)
        print(f"Terminal data exported to {export_path}")
        return

    if args.command == "serve-api":
        serve_api(app, port=args.port)
        return

    asyncio.run(app.run_trade_monitor())


if __name__ == "__main__":
    main()
