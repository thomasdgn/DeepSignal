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
    latest_event = _format_timestamp(dashboard_data["latest_timestamp_ms"])
    timeline_chart = _build_timeline_chart(dashboard_data["timeline"])
    hot_symbols_chart = _build_hot_symbols_chart(dashboard_data["hot_symbols"])
    directional_chart = _build_directional_flow_chart(dashboard_data["directional_flow"])
    top_symbols_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>{item['event_count']}</td>"
            f"<td>${item['total_notional_usd']:,.2f}</td><td>{item['avg_score']:,.2f}</td>"
            f"<td>{item['max_score']:,.2f}</td></tr>"
        )
        for item in dashboard_data["top_symbols"]
    ) or "<tr><td colspan='5'>No whale alerts stored yet.</td></tr>"

    side_rows = "".join(
        (
            f"<tr><td>{item['side']}</td><td>{item['event_count']}</td>"
            f"<td>${item['total_notional_usd']:,.2f}</td></tr>"
        )
        for item in dashboard_data["side_breakdown"]
    ) or "<tr><td colspan='3'>No side data yet.</td></tr>"

    recent_rows = "".join(
        (
            f"<tr class='filterable-row' {_alert_dataset(item)}><td>{item['symbol']}</td><td>{item['side']}</td><td>{item['severity']}</td>"
            f"<td>${item['notional_usd']:,.2f}</td><td>{_format_timestamp(item['timestamp_ms'])}</td>"
            f"<td>{', '.join(item['tags'])}</td></tr>"
        )
        for item in dashboard_data["recent_alerts"]
    ) or "<tr><td colspan='6'>No recent alerts yet.</td></tr>"

    ranked_rows = "".join(
        (
            f"<tr class='filterable-row' {_alert_dataset(item)}><td>{item['symbol']}</td><td>{item['score']:,.2f}</td><td>{item['severity']}</td>"
            f"<td>${item['notional_usd']:,.2f}</td><td>{_format_timestamp(item['timestamp_ms'])}</td>"
            f"<td>{_score_reason(item['score_breakdown'])}</td></tr>"
        )
        for item in dashboard_data["ranked_alerts"]
    ) or "<tr><td colspan='6'>No scored alerts yet.</td></tr>"

    timeline_rows = "".join(
        (
            f"<tr><td>{_format_timestamp(item['bucket_start_ms'])}</td><td>{item['event_count']}</td>"
            f"<td>${item['total_notional_usd']:,.2f}</td><td>{item['max_score']:,.2f}</td></tr>"
        )
        for item in dashboard_data["timeline"]
    ) or "<tr><td colspan='4'>No timeline data yet.</td></tr>"

    narrative_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>{item['market_signal']}</td><td>{item['avg_attention_score']:,.2f}</td>"
            f"<td>{item['avg_score']:,.2f}</td><td>{item['event_count']}</td></tr>"
        )
        for item in dashboard_data["narrative_summary"]
    ) or "<tr><td colspan='5'>No ELFA narrative summary yet.</td></tr>"

    hot_symbol_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>{item['hot_score']:,.2f}</td><td>{item['avg_score']:,.2f}</td>"
            f"<td>{item['avg_attention_score']:,.2f}</td><td>{item['event_count']}</td></tr>"
        )
        for item in dashboard_data["hot_symbols"]
    ) or "<tr><td colspan='5'>No hot symbols yet.</td></tr>"

    directional_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>${item['bullish_notional_usd']:,.2f}</td>"
            f"<td>${item['bearish_notional_usd']:,.2f}</td><td>{_format_signed_usd(item['net_flow_usd'])}</td>"
            f"<td>{item['max_score']:,.2f}</td></tr>"
        )
        for item in dashboard_data["directional_flow"]
    ) or "<tr><td colspan='5'>No directional flow yet.</td></tr>"

    pressure_rows = "".join(
        (
            f"<tr><td>{item['symbol']}</td><td>${item['open_long_usd']:,.2f}</td>"
            f"<td>${item['open_short_usd']:,.2f}</td><td>${item['close_long_usd']:,.2f}</td>"
            f"<td>${item['close_short_usd']:,.2f}</td></tr>"
        )
        for item in dashboard_data["pressure_split"]
    ) or "<tr><td colspan='5'>No pressure split yet.</td></tr>"

    explainer_cards = "".join(
        _build_explainer_card(item) for item in dashboard_data["ranked_alerts"][:5]
    ) or "<article class='card'><h2>Narrative Explainers</h2><p>No ranked alerts yet.</p></article>"

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
      --bg: #efe7d8;
      --bg-deep: #122027;
      --panel: rgba(255, 250, 242, 0.82);
      --panel-strong: rgba(255, 248, 238, 0.94);
      --ink: #16242b;
      --muted: #61707a;
      --accent: #0b7668;
      --accent-soft: #d5efe8;
      --danger: #8f2d1f;
      --success: #16685d;
      --line: rgba(24, 46, 52, 0.12);
      --shadow: 0 20px 50px rgba(18, 32, 39, 0.12);
      --font-display: Georgia, "Times New Roman", serif;
      --font-body: "Segoe UI", Tahoma, sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(11,118,104,0.22), transparent 24%),
        radial-gradient(circle at 85% 10%, rgba(18,32,39,0.15), transparent 20%),
        linear-gradient(180deg, #f6f0e5 0%, var(--bg) 52%, #e9dec9 100%);
      color: var(--ink);
      font-family: var(--font-body);
    }}
    main {{
      max-width: 1380px;
      margin: 0 auto;
      padding: 28px 20px 60px;
    }}
    h1, h2, h3 {{
      font-family: var(--font-display);
      margin: 0 0 12px;
      line-height: 1.1;
    }}
    p {{ color: var(--muted); margin: 0; }}
    .hero {{
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
      gap: 18px;
      margin-bottom: 18px;
    }}
    .hero-main, .hero-side {{
      background:
        linear-gradient(135deg, rgba(255,248,238,0.95), rgba(246,238,225,0.88));
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }}
    .hero-main {{
      padding: 28px;
      position: relative;
      overflow: hidden;
    }}
    .hero-main::after {{
      content: "";
      position: absolute;
      inset: auto -40px -50px auto;
      width: 180px;
      height: 180px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(11,118,104,0.18), transparent 70%);
    }}
    .hero-side {{
      padding: 20px;
      background:
        linear-gradient(180deg, rgba(18,32,39,0.96), rgba(20,48,56,0.94));
      color: #f4efe5;
    }}
    .hero-kicker {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }}
    .hero h1 {{
      font-size: clamp(2.2rem, 4vw, 4rem);
      max-width: 12ch;
      margin-bottom: 10px;
    }}
    .hero-copy {{
      max-width: 60ch;
      line-height: 1.55;
      font-size: 1rem;
    }}
    .hero-strip {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 20px;
    }}
    .strip-box {{
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }}
    .strip-label {{
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }}
    .strip-value {{
      margin-top: 6px;
      font-size: 1.1rem;
      font-weight: 700;
    }}
    .side-title {{
      font-size: 1.3rem;
      margin-bottom: 10px;
    }}
    .status-list {{
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }}
    .status-item {{
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.08);
    }}
    .status-label {{
      color: rgba(244, 239, 229, 0.68);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    .status-value {{
      margin-top: 4px;
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff8ef;
    }}
    .stats {{
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }}
    .card {{
      background: var(--panel);
      backdrop-filter: blur(10px);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      box-shadow: var(--shadow);
    }}
    .card-strong {{
      background: var(--panel-strong);
    }}
    .card h2 {{
      font-size: 1.45rem;
    }}
    .metric {{
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }}
    .metric-sub {{
      margin-top: 6px;
      color: var(--muted);
      font-size: 0.9rem;
    }}
    .grid {{
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(340px, 0.9fr);
      gap: 18px;
    }}
    .stack {{
      display: grid;
      gap: 18px;
    }}
    .subgrid-two {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }}
    .section-title {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }}
    .section-meta {{
      color: var(--muted);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    .chip-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }}
    .control-bar {{
      display: grid;
      grid-template-columns: 1.2fr 0.9fr 0.9fr 0.8fr auto auto;
      gap: 12px;
      margin-bottom: 18px;
      align-items: end;
    }}
    .control-group {{
      display: grid;
      gap: 6px;
    }}
    .control-label {{
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }}
    .control-input, .control-select {{
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.7);
      border-radius: 14px;
      padding: 11px 12px;
      color: var(--ink);
      font: inherit;
    }}
    .control-button {{
      border: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(11,118,104,0.16), rgba(255,255,255,0.72));
      border-radius: 14px;
      padding: 11px 14px;
      color: var(--ink);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }}
    .refresh-status {{
      color: var(--muted);
      font-size: 0.84rem;
      margin-top: 6px;
    }}
    .chip {{
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(11,118,104,0.1);
      color: var(--accent);
      font-size: 0.86rem;
      font-weight: 600;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }}
    th, td {{
      text-align: left;
      padding: 11px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    .table-wrap {{
      overflow-x: auto;
    }}
    .viz-card {{
      padding: 20px;
    }}
    .viz-head {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }}
    .viz-note {{
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.5;
    }}
    .chart-shell {{
      background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(244,236,224,0.65));
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 12px;
      overflow: hidden;
    }}
    .chart-svg {{
      display: block;
      width: 100%;
      height: auto;
    }}
    .spark-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }}
    .bars {{
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }}
    .bar-row {{
      display: grid;
      grid-template-columns: 74px minmax(0, 1fr) 72px;
      gap: 10px;
      align-items: center;
      font-size: 0.9rem;
    }}
    .bar-track {{
      position: relative;
      height: 12px;
      border-radius: 999px;
      background: rgba(18,32,39,0.08);
      overflow: hidden;
    }}
    .bar-fill {{
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(11,118,104,0.72), rgba(24,153,136,0.92));
    }}
    .bar-fill.attention {{
      background: linear-gradient(90deg, rgba(143,45,31,0.55), rgba(191,92,70,0.92));
    }}
    .foot {{
      font-size: 0.88rem;
      color: var(--warning);
    }}
    .net-positive {{ color: var(--success); font-weight: 700; }}
    .net-negative {{ color: var(--danger); font-weight: 700; }}
    .explainer-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
    }}
    .is-hidden {{
      display: none !important;
    }}
    .explainer-status {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(11,118,104,0.1);
      color: var(--accent);
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 12px;
    }}
    ul {{
      margin: 12px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.5;
    }}
    li + li {{
      margin-top: 8px;
    }}
    .full-width {{
      grid-column: 1 / -1;
    }}
    @media (max-width: 1120px) {{
      .hero, .grid {{
        grid-template-columns: 1fr;
      }}
      .stats {{
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }}
      .control-bar {{
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }}
    }}
    @media (max-width: 720px) {{
      main {{
        padding: 18px 12px 40px;
      }}
      .hero-main, .hero-side, .card {{
        padding: 16px;
      }}
      .hero-strip, .subgrid-two, .spark-grid, .control-bar {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <article class="hero-main">
        <div class="hero-kicker">DeepSignal Command Center</div>
        <h1>DeepSignal Whale Dashboard</h1>
        <p class="hero-copy">A live intelligence console for Pacifica whale flow, directional pressure, and narrative acceleration. High-score events, hot symbols, and ELFA context are prioritized for faster operator decisions.</p>
        <div class="chip-row">
          <div class="chip">Lookback {dashboard_data['lookback_hours']}h</div>
          <div class="chip">Latest event {latest_event}</div>
          <div class="chip">Generated {generated_at}</div>
        </div>
        <div class="hero-strip">
          <div class="strip-box">
            <div class="strip-label">Primary Objective</div>
            <div class="strip-value">Find abnormal whale flow before the crowd does.</div>
          </div>
          <div class="strip-box">
            <div class="strip-label">Current Focus</div>
            <div class="strip-value">Score impact, explain narrative, route only high-signal alerts.</div>
          </div>
          <div class="strip-box">
            <div class="strip-label">System State</div>
            <div class="strip-value">Storage-backed analytics with command-level alert triage.</div>
          </div>
        </div>
      </article>
      <aside class="hero-side">
        <h2 class="side-title">Operations Snapshot</h2>
        <div class="status-list">
          <div class="status-item">
            <div class="status-label">Total Whale Alerts</div>
            <div class="status-value">{dashboard_data['total_alerts']}</div>
          </div>
          <div class="status-item">
            <div class="status-label">Total Whale Notional</div>
            <div class="status-value">${dashboard_data['total_notional_usd']:,.2f}</div>
          </div>
          <div class="status-item">
            <div class="status-label">Largest Alert</div>
            <div class="status-value">${dashboard_data['largest_alert_usd']:,.2f}</div>
          </div>
          <div class="status-item">
            <div class="status-label">Highest Whale Score</div>
            <div class="status-value">{dashboard_data['highest_score']:,.2f}</div>
          </div>
        </div>
      </aside>
    </section>
    <section class="stats">
      <article class="card card-strong">
        <div class="metric">{dashboard_data['lookback_hours']}h</div>
        <div class="metric-sub">Analysis window</div>
      </article>
      <article class="card">
        <div class="metric">{dashboard_data['total_alerts']}</div>
        <div class="metric-sub">Stored whale events</div>
      </article>
      <article class="card">
        <div class="metric">${dashboard_data['total_notional_usd']:,.0f}</div>
        <div class="metric-sub">Total whale notional</div>
      </article>
      <article class="card">
        <div class="metric">${dashboard_data['largest_alert_usd']:,.0f}</div>
        <div class="metric-sub">Largest single event</div>
      </article>
      <article class="card">
        <div class="metric">{dashboard_data['highest_score']:,.2f}</div>
        <div class="metric-sub">Highest risk score</div>
      </article>
    </section>
    <section class="card card-strong" style="margin-bottom:18px;">
      <div class="section-title">
        <h2>Live Controls</h2>
        <div class="section-meta">Filters and refresh</div>
      </div>
      <div class="control-bar">
        <label class="control-group">
          <span class="control-label">Symbol Search</span>
          <input id="filter-symbol" class="control-input" type="text" placeholder="BTC, ETH, SOL">
        </label>
        <label class="control-group">
          <span class="control-label">Severity</span>
          <select id="filter-severity" class="control-select">
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </label>
        <label class="control-group">
          <span class="control-label">Side</span>
          <select id="filter-side" class="control-select">
            <option value="">All</option>
            <option value="open_long">open_long</option>
            <option value="open_short">open_short</option>
            <option value="close_long">close_long</option>
            <option value="close_short">close_short</option>
          </select>
        </label>
        <label class="control-group">
          <span class="control-label">Min Score</span>
          <input id="filter-min-score" class="control-input" type="number" min="0" step="1" placeholder="0">
        </label>
        <button id="toggle-refresh" class="control-button" type="button">Auto Refresh: Off</button>
        <button id="reset-filters" class="control-button" type="button">Reset Filters</button>
      </div>
      <div id="refresh-status" class="refresh-status">Static mode. Turn on auto refresh to reload this report every 15 seconds.</div>
    </section>
    <section class="grid">
      <div class="stack">
        <article class="card card-strong">
          <div class="section-title">
            <h2>Hot Symbols Now</h2>
            <div class="section-meta">Score + attention + activity</div>
          </div>
          <div class="bars">{hot_symbols_chart}</div>
        </article>
        <article class="card viz-card">
          <div class="viz-head">
            <h2>Flow Pulse</h2>
            <div class="section-meta">Visual timeline</div>
          </div>
          <div class="chart-shell">{timeline_chart}</div>
          <p class="viz-note" style="margin-top:12px;">Event frequency and total whale notional mapped by hour to show acceleration windows.</p>
        </article>
        <article class="card full-width viz-card">
          <div class="viz-head">
            <h2>Directional Pressure Map</h2>
            <div class="section-meta">Bullish vs bearish</div>
          </div>
          <div class="chart-shell">{directional_chart}</div>
          <p class="viz-note" style="margin-top:12px;">Positive bars indicate bullish whale pressure. Negative bars indicate bearish dominance.</p>
        </article>
        <article class="card card-strong">
          <div class="section-title">
            <h2>Hot Symbols Now</h2>
            <div class="section-meta">Score + attention + activity</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Hot Score</th><th>Avg Score</th><th>Avg Attention</th><th>Alerts</th></tr></thead>
              <tbody>{hot_symbol_rows}</tbody>
            </table>
          </div>
        </article>
        <article class="card full-width">
          <div class="section-title">
            <h2>Directional Flow</h2>
            <div class="section-meta">Directional Flow</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Bullish Flow</th><th>Bearish Flow</th><th>Net Flow</th><th>Max Score</th></tr></thead>
              <tbody>{directional_rows}</tbody>
            </table>
          </div>
        </article>
        <div class="subgrid-two">
          <article class="card">
            <div class="section-title">
              <h2>Flow Timeline</h2>
              <div class="section-meta">Hourly buckets</div>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Hour</th><th>Alerts</th><th>Total Notional</th><th>Max Score</th></tr></thead>
                <tbody>{timeline_rows}</tbody>
              </table>
            </div>
          </article>
          <article class="card">
            <div class="section-title">
              <h2>Narrative Signals</h2>
              <div class="section-meta">ELFA attention layer</div>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Symbol</th><th>Signal</th><th>Avg Attention</th><th>Avg Score</th><th>Alerts</th></tr></thead>
                <tbody>{narrative_rows}</tbody>
              </table>
            </div>
          </article>
        </div>
        <article class="card full-width">
          <div class="section-title">
            <h2>Pressure Split By Symbol</h2>
            <div class="section-meta">Opening and closing pressure</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Open Long</th><th>Open Short</th><th>Close Long</th><th>Close Short</th></tr></thead>
              <tbody>{pressure_rows}</tbody>
            </table>
          </div>
        </article>
        <article class="card full-width">
          <div class="section-title">
            <h2>Recent Whale Alerts</h2>
            <div class="section-meta">Live event stream</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Side</th><th>Severity</th><th>Notional</th><th>Time</th><th>Tags</th></tr></thead>
              <tbody>{recent_rows}</tbody>
            </table>
          </div>
        </article>
      </div>
      <div class="stack">
        <article class="card card-strong">
          <div class="section-title">
            <h2>Top Ranked Whale Alerts</h2>
            <div class="section-meta">Priority queue</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Score</th><th>Severity</th><th>Notional</th><th>Time</th><th>Why It Ranked</th></tr></thead>
              <tbody>{ranked_rows}</tbody>
            </table>
          </div>
        </article>
        <article class="card">
          <div class="section-title">
            <h2>Top Symbols By Score</h2>
            <div class="section-meta">Leaderboard</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Alerts</th><th>Total Notional</th><th>Avg Score</th><th>Max Score</th></tr></thead>
              <tbody>{top_symbols_rows}</tbody>
            </table>
          </div>
        </article>
        <article class="card">
          <div class="section-title">
            <h2>Attention Ladder</h2>
            <div class="section-meta">ELFA-weighted heat</div>
          </div>
          <div class="bars">{_build_attention_bars(dashboard_data["narrative_summary"])}</div>
        </article>
        <article class="card">
          <div class="section-title">
            <h2>Side Breakdown</h2>
            <div class="section-meta">Aggregate pressure</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Side</th><th>Alerts</th><th>Total Notional</th></tr></thead>
              <tbody>{side_rows}</tbody>
            </table>
          </div>
        </article>
        <section class="explainer-grid">
          {explainer_cards}
        </section>
        <article class="card">
          <div class="section-title">
            <h2>Tracked Accounts</h2>
            <div class="section-meta">Wallet watch</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Label</th><th>Account</th><th>Latest Snapshot</th><th>Max Equity</th><th>Max Balance</th><th>Snapshots</th></tr></thead>
              <tbody>{watchlist_rows}</tbody>
            </table>
          </div>
          <p class="foot" style="margin-top:12px;">Command center status is based on locally stored events and snapshots.</p>
        </article>
      </div>
    </section>
  </main>
  <script>
    (() => {{
      const rows = Array.from(document.querySelectorAll('.filterable-row'));
      const cards = Array.from(document.querySelectorAll('.filterable-card'));
      const symbolInput = document.getElementById('filter-symbol');
      const severityInput = document.getElementById('filter-severity');
      const sideInput = document.getElementById('filter-side');
      const minScoreInput = document.getElementById('filter-min-score');
      const resetButton = document.getElementById('reset-filters');
      const toggleRefreshButton = document.getElementById('toggle-refresh');
      const refreshStatus = document.getElementById('refresh-status');
      let refreshTimer = null;

      function currentFilters() {{
        return {{
          symbol: symbolInput.value.trim().toLowerCase(),
          severity: severityInput.value.trim().toLowerCase(),
          side: sideInput.value.trim().toLowerCase(),
          minScore: Number(minScoreInput.value || 0),
        }};
      }}

      function matchesFilters(dataset, filters) {{
        const symbol = String(dataset.symbol || '').toLowerCase();
        const severity = String(dataset.severity || '').toLowerCase();
        const side = String(dataset.side || '').toLowerCase();
        const score = Number(dataset.score || 0);
        if (filters.symbol && !symbol.includes(filters.symbol)) return false;
        if (filters.severity && severity !== filters.severity) return false;
        if (filters.side && side !== filters.side) return false;
        if (score < filters.minScore) return false;
        return true;
      }}

      function applyFilters() {{
        const filters = currentFilters();
        rows.forEach((row) => {{
          row.classList.toggle('is-hidden', !matchesFilters(row.dataset, filters));
        }});
        cards.forEach((card) => {{
          card.classList.toggle('is-hidden', !matchesFilters(card.dataset, filters));
        }});
      }}

      function resetFilters() {{
        symbolInput.value = '';
        severityInput.value = '';
        sideInput.value = '';
        minScoreInput.value = '';
        applyFilters();
      }}

      function setRefresh(enabled) {{
        if (refreshTimer) {{
          window.clearInterval(refreshTimer);
          refreshTimer = null;
        }}
        if (enabled) {{
          toggleRefreshButton.textContent = 'Auto Refresh: On';
          refreshStatus.textContent = 'Auto refresh enabled. Reloading this report every 15 seconds.';
          refreshTimer = window.setInterval(() => window.location.reload(), 15000);
        }} else {{
          toggleRefreshButton.textContent = 'Auto Refresh: Off';
          refreshStatus.textContent = 'Static mode. Turn on auto refresh to reload this report every 15 seconds.';
        }}
      }}

      [symbolInput, severityInput, sideInput, minScoreInput].forEach((element) => {{
        element.addEventListener('input', applyFilters);
        element.addEventListener('change', applyFilters);
      }});
      resetButton.addEventListener('click', resetFilters);
      toggleRefreshButton.addEventListener('click', () => {{
        setRefresh(!refreshTimer);
      }});

      applyFilters();
    }})();
  </script>
</body>
</html>
"""


def _format_timestamp(timestamp_ms: int) -> str:
    if timestamp_ms <= 0:
        return "n/a"
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()


def _score_reason(score_breakdown: dict[str, Any]) -> str:
    if not score_breakdown:
        return "n/a"

    reasons: list[str] = []
    multiple = score_breakdown.get("multiple_of_threshold")
    if isinstance(multiple, (int, float)):
        reasons.append(f"{multiple:.2f}x threshold")

    liquidation_bonus = score_breakdown.get("liquidation_bonus")
    if isinstance(liquidation_bonus, (int, float)) and liquidation_bonus > 0:
        reasons.append("liquidation context")

    side_bonus = score_breakdown.get("side_bonus")
    if isinstance(side_bonus, (int, float)) and side_bonus >= 8:
        reasons.append("opening pressure")

    return ", ".join(reasons) or "base whale size"


def _build_explainer_card(alert: dict[str, Any]) -> str:
    enrichment = alert.get("enrichment", {})
    if not isinstance(enrichment, dict):
        enrichment = {}

    status = str(enrichment.get("elfa_status", "disabled"))
    market_signal = str(enrichment.get("elfa_market_signal", "n/a"))
    attention_score = enrichment.get("elfa_attention_score", 0)
    explainer_lines = enrichment.get("elfa_explainer", [])
    if not isinstance(explainer_lines, list):
        explainer_lines = []

    details = "".join(f"<li>{line}</li>" for line in explainer_lines[:3]) or "<li>No ELFA context yet.</li>"

    return (
        f"<article class='card card-strong filterable-card' {_alert_dataset(alert)}>"
        f"<div class='explainer-status'>{market_signal} | ELFA {status}</div>"
        f"<h2>{alert['symbol']} Narrative Explainer</h2>"
        f"<p>Score {alert['score']:,.2f} | {alert['severity']} | Attention {float(attention_score):,.2f}</p>"
        f"<ul>{details}</ul>"
        "</article>"
    )


def _format_signed_usd(value: float) -> str:
    prefix = "+" if value > 0 else ""
    css_class = "net-positive" if value > 0 else "net-negative" if value < 0 else ""
    return f"<span class='{css_class}'>{prefix}${value:,.2f}</span>"


def _build_timeline_chart(items: list[dict[str, Any]]) -> str:
    if not items:
        return "<p class='viz-note'>No timeline data yet.</p>"

    ordered = sorted(items, key=lambda item: item["bucket_start_ms"])
    width = 640
    height = 220
    padding = 26
    plot_width = width - padding * 2
    plot_height = height - padding * 2
    max_notional = max(item["total_notional_usd"] for item in ordered) or 1
    max_events = max(item["event_count"] for item in ordered) or 1
    step = plot_width / max(len(ordered) - 1, 1)

    area_points: list[str] = []
    line_points: list[str] = []
    circles: list[str] = []
    labels: list[str] = []

    for idx, item in enumerate(ordered):
        x = padding + idx * step
        y_notional = padding + plot_height - (item["total_notional_usd"] / max_notional) * plot_height
        y_events = padding + plot_height - (item["event_count"] / max_events) * plot_height
        area_points.append(f"{x:.1f},{y_notional:.1f}")
        line_points.append(f"{x:.1f},{y_events:.1f}")
        circles.append(f"<circle cx='{x:.1f}' cy='{y_events:.1f}' r='4' fill='#8f2d1f' />")
        labels.append(
            f"<text x='{x:.1f}' y='{height - 6}' text-anchor='middle' font-size='10' fill='#61707a'>{_short_hour(item['bucket_start_ms'])}</text>"
        )

    polygon_points = (
        f"{padding},{height - padding} "
        + " ".join(area_points)
        + f" {padding + step * (len(ordered) - 1):.1f},{height - padding}"
    )
    return (
        f"<svg class='chart-svg' viewBox='0 0 {width} {height}' role='img' aria-label='Timeline chart'>"
        f"<rect x='{padding}' y='{padding}' width='{plot_width}' height='{plot_height}' rx='16' fill='rgba(255,255,255,0.38)' />"
        f"<polygon points='{polygon_points}' fill='rgba(11,118,104,0.18)' />"
        f"<polyline points='{' '.join(area_points)}' fill='none' stroke='#0b7668' stroke-width='3' stroke-linecap='round' />"
        f"<polyline points='{' '.join(line_points)}' fill='none' stroke='#8f2d1f' stroke-width='2.5' stroke-linecap='round' />"
        + "".join(circles)
        + "".join(labels)
        + "</svg>"
    )


def _build_hot_symbols_chart(items: list[dict[str, Any]]) -> str:
    if not items:
        return "<p class='viz-note'>No hot symbols yet.</p>"
    return "".join(
        _bar_row(item["symbol"], float(item["hot_score"]), _max_value(items, "hot_score"), f"{item['hot_score']:.1f}")
        for item in items[:6]
    )


def _build_attention_bars(items: list[dict[str, Any]]) -> str:
    if not items:
        return "<p class='viz-note'>No ELFA attention data yet.</p>"
    max_value = _max_value(items, "avg_attention_score")
    return "".join(
        _bar_row(
            item["symbol"],
            float(item["avg_attention_score"]),
            max_value,
            f"{item['avg_attention_score']:.1f}",
            fill_class="attention",
        )
        for item in items[:6]
    )


def _bar_row(label: str, value: float, max_value: float, suffix: str, fill_class: str = "") -> str:
    width_pct = 0 if max_value <= 0 else max(4.0, min(100.0, (value / max_value) * 100))
    class_suffix = f" {fill_class}".rstrip()
    return (
        "<div class='bar-row'>"
        f"<div>{label}</div>"
        "<div class='bar-track'>"
        f"<div class='bar-fill{class_suffix}' style='width:{width_pct:.1f}%'></div>"
        "</div>"
        f"<div>{suffix}</div>"
        "</div>"
    )


def _build_directional_flow_chart(items: list[dict[str, Any]]) -> str:
    if not items:
        return "<p class='viz-note'>No directional flow data yet.</p>"

    width = 640
    row_height = 34
    padding = 28
    chart_height = padding * 2 + row_height * len(items)
    max_abs = max(abs(float(item["net_flow_usd"])) for item in items) or 1
    center_x = width / 2
    bar_half_width = width / 2 - 110

    rows: list[str] = []
    for idx, item in enumerate(items):
        y = padding + idx * row_height + 8
        net = float(item["net_flow_usd"])
        magnitude = abs(net) / max_abs
        length = magnitude * bar_half_width
        if net >= 0:
            x = center_x
            color = "#0b7668"
        else:
            x = center_x - length
            color = "#8f2d1f"
        rows.append(
            f"<text x='10' y='{y + 10}' font-size='11' fill='#61707a'>{item['symbol']}</text>"
            f"<rect x='{center_x - bar_half_width:.1f}' y='{y:.1f}' width='{bar_half_width * 2:.1f}' height='14' rx='7' fill='rgba(18,32,39,0.06)' />"
            f"<rect x='{x:.1f}' y='{y:.1f}' width='{max(length, 3):.1f}' height='14' rx='7' fill='{color}' opacity='0.88' />"
            f"<text x='{width - 10}' y='{y + 10}' text-anchor='end' font-size='11' fill='#16242b'>{net:,.0f}</text>"
        )

    return (
        f"<svg class='chart-svg' viewBox='0 0 {width} {chart_height}' role='img' aria-label='Directional flow chart'>"
        f"<line x1='{center_x:.1f}' y1='10' x2='{center_x:.1f}' y2='{chart_height - 10}' stroke='rgba(18,32,39,0.18)' stroke-width='2' stroke-dasharray='5 5' />"
        + "".join(rows)
        + "</svg>"
    )


def _max_value(items: list[dict[str, Any]], key: str) -> float:
    return max(float(item.get(key, 0) or 0) for item in items) or 1.0


def _short_hour(timestamp_ms: int) -> str:
    if timestamp_ms <= 0:
        return "n/a"
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).strftime("%H:%M")


def _alert_dataset(item: dict[str, Any]) -> str:
    symbol = str(item.get("symbol", ""))
    severity = str(item.get("severity", ""))
    side = str(item.get("side", ""))
    score = float(item.get("score", 0) or 0)
    return (
        f"data-symbol='{_escape_attr(symbol)}' "
        f"data-severity='{_escape_attr(severity)}' "
        f"data-side='{_escape_attr(side)}' "
        f"data-score='{score:.2f}'"
    )


def _escape_attr(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("'", "&#39;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
