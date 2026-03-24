from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def render_dashboard_report(report_path: Path, dashboard_data: dict[str, Any]) -> Path:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(_build_html(dashboard_data), encoding="utf-8")
    return report_path


def _build_html(dashboard_data: dict[str, Any]) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    top_symbols_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>{item['event_count']}</td>"
            f"<td>${item['total_notional_usd']:,.2f}</td></tr>"
        )
        for item in dashboard_data["top_symbols"]
    ) or "<tr><td colspan='3'>No whale alerts stored yet.</td></tr>"

    side_rows = "".join(
        (
            f"<tr><td>{item['side']}</td><td>{item['event_count']}</td>"
            f"<td>${item['total_notional_usd']:,.2f}</td></tr>"
        )
        for item in dashboard_data["side_breakdown"]
    ) or "<tr><td colspan='3'>No side data yet.</td></tr>"

    recent_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>{item['side']}</td><td>{item['severity']}</td>"
            f"<td>${item['notional_usd']:,.2f}</td><td>{_format_timestamp(item['timestamp_ms'])}</td>"
            f"<td>{', '.join(item['tags'])}</td></tr>"
        )
        for item in dashboard_data["recent_alerts"]
    ) or "<tr><td colspan='6'>No recent alerts yet.</td></tr>"

    watchlist_rows = "".join(
        (
            f"<tr><td>{item['label']}</td><td>{item['account_address']}</td>"
            f"<td>{_format_timestamp(item['latest_snapshot_ms'])}</td>"
            f"<td>${item['max_equity']:,.2f}</td><td>${item['max_balance']:,.2f}</td>"
            f"<td>{item['snapshot_count']}</td></tr>"
        )
        for item in dashboard_data["watchlist_accounts"]
    ) or "<tr><td colspan='6'>No watchlist snapshots stored yet.</td></tr>"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeepSignal Dashboard</title>
  <style>
    :root {{
      --bg: #f4f0e8;
      --panel: #fffaf2;
      --ink: #1f2933;
      --muted: #6b7280;
      --accent: #0f766e;
      --line: #e7dbc8;
      --warning: #9a3412;
      --font-display: Georgia, "Times New Roman", serif;
      --font-body: "Segoe UI", Tahoma, sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background:
        radial-gradient(circle at top right, rgba(15,118,110,0.14), transparent 28%),
        linear-gradient(180deg, #f7f3eb 0%, var(--bg) 100%);
      color: var(--ink);
      font-family: var(--font-body);
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }}
    h1, h2 {{
      font-family: var(--font-display);
      margin: 0 0 12px;
      line-height: 1.1;
    }}
    p {{ color: var(--muted); }}
    .hero {{
      background: linear-gradient(135deg, rgba(15,118,110,0.1), rgba(255,250,242,0.95));
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 22px;
    }}
    .stats {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(31, 41, 51, 0.05);
    }}
    .metric {{
      font-size: 1.7rem;
      font-weight: 700;
      color: var(--accent);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }}
    th, td {{
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
    }}
    .foot {{
      margin-top: 16px;
      font-size: 0.9rem;
      color: var(--warning);
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>DeepSignal Whale Dashboard</h1>
      <p>Generated from local Pacifica whale alerts and tracked-account snapshots.</p>
      <div class="stats">
        <article class="card">
          <div>Lookback</div>
          <div class="metric">{dashboard_data['lookback_hours']}h</div>
        </article>
        <article class="card">
          <div>Total Whale Alerts</div>
          <div class="metric">{dashboard_data['total_alerts']}</div>
        </article>
        <article class="card">
          <div>Total Whale Notional</div>
          <div class="metric">${dashboard_data['total_notional_usd']:,.2f}</div>
        </article>
        <article class="card">
          <div>Largest Alert</div>
          <div class="metric">${dashboard_data['largest_alert_usd']:,.2f}</div>
        </article>
      </div>
      <p class="foot">Generated at {generated_at}. Latest stored event: {_format_timestamp(dashboard_data['latest_timestamp_ms'])}.</p>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Top Symbols</h2>
        <table>
          <thead><tr><th>Symbol</th><th>Alerts</th><th>Total Notional</th></tr></thead>
          <tbody>{top_symbols_rows}</tbody>
        </table>
      </article>
      <article class="card">
        <h2>Side Breakdown</h2>
        <table>
          <thead><tr><th>Side</th><th>Alerts</th><th>Total Notional</th></tr></thead>
          <tbody>{side_rows}</tbody>
        </table>
      </article>
      <article class="card" style="grid-column: 1 / -1;">
        <h2>Recent Whale Alerts</h2>
        <table>
          <thead><tr><th>Symbol</th><th>Side</th><th>Severity</th><th>Notional</th><th>Time</th><th>Tags</th></tr></thead>
          <tbody>{recent_rows}</tbody>
        </table>
      </article>
      <article class="card" style="grid-column: 1 / -1;">
        <h2>Tracked Accounts</h2>
        <table>
          <thead><tr><th>Label</th><th>Account</th><th>Latest Snapshot</th><th>Max Equity</th><th>Max Balance</th><th>Snapshots</th></tr></thead>
          <tbody>{watchlist_rows}</tbody>
        </table>
      </article>
    </section>
  </main>
</body>
</html>
"""


def _format_timestamp(timestamp_ms: int) -> str:
    if timestamp_ms <= 0:
        return "n/a"
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()
