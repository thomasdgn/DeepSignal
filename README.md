# DeepSignal

Pacifica Hackathon project for the `Analytics & Data` track.

DeepSignal is a whale-watcher foundation built on Pacifica market data. It now covers:

- Pacifica REST + WebSocket ingestion
- real-time whale trade detection
- whale scoring and ranked alerting
- local SQLite storage for whale alerts and tracked accounts
- local HTML dashboard generation
- ELFA AI live enrichment and narrative explainers
- Discord/webhook alert delivery for high-score whale events

## Shared Repo Safety

This repository is set up so you and your teammate can work on different machines without pushing machine-specific files into Git.

Kept out of Git on purpose:

- `.env`
- `watchlist.local.json`
- `data/`
- `reports/`
- `*.db`

That means:

- each developer keeps their own secrets locally
- each developer keeps their own local database and generated reports
- no OS-specific absolute paths are committed
- the code stays portable across Windows, macOS, and Linux as long as Python works

Safe things to commit:

- source code
- `requirements.txt`
- `.env.example`
- `watchlist.example.json`
- documentation and tests

## Current Foundation

Main modules:

- `deepsignal/pacifica/rest.py`: Pacifica REST client
- `deepsignal/pacifica/ws.py`: Pacifica WebSocket trade stream client
- `deepsignal/detection.py`: whale detection rules
- `deepsignal/storage.py`: local SQLite persistence
- `deepsignal/watchlist.py`: tracked-account watchlist loader
- `deepsignal/account_analysis.py`: account/watchlist sync
- `deepsignal/reporting.py`: local dashboard generator
- `deepsignal/sponsors/elfa_client.py`: ELFA REST client
- `deepsignal/sponsors/elfa.py`: ELFA enrichment logic
- `deepsignal/app.py`: orchestration
- `deepsignal/cli.py`: CLI entrypoint
- `frontend/`: React/Vite market-intelligence terminal frontend

## Pacifica Integration

Aligned with Pacifica docs and SDK structure:

- REST base URL: `https://api.pacifica.fi/api/v1`
- WebSocket base URL: `wss://ws.pacifica.fi/ws`
- Testnet REST base URL: `https://test-api.pacifica.fi/api/v1`
- Testnet WebSocket base URL: `wss://test-ws.pacifica.fi/ws`

Endpoints currently used or prepared:

- `GET /info`
- `GET /trades?symbol=...`
- `GET /account?account=...`
- `GET /account/balance/history?account=...`
- WebSocket `trades` subscription

Useful links:

- Pacifica builder docs: https://docs.pacifica.fi/builder-program
- Pacifica API docs: https://docs.pacifica.fi/api-documentation/api
- Pacifica Python SDK: https://github.com/pacifica-fi/python-sdk
- ELFA API docs: https://docs.elfa.ai/
- ELFA hackathon docs: https://go.elfa.ai/docs-hackathon

## Sponsor Choice

`ELFA AI` is still the best sponsor fit right now.

Why:

- it directly strengthens the analytics story
- it can add external context to whale events
- it gives you a cleaner demo narrative than adding unrelated integrations

Other sponsors are less relevant for the current scope:

- `Privy`: now useful for the frontend app because `Connect` and `Watchlists` support wallet/user identity
- `Fuul`: useful if you add referrals, campaigns, or distribution loops
- `Rhino.fi`: only useful if the product expands into cross-chain or bridging flows

Pragmatic recommendation:

- keep `ELFA AI` as the primary sponsor integration now
- consider `Privy` later only if you decide to build a real web product around user accounts

## Setup

1. Create a virtual environment.

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create your local environment file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

4. Create your local watchlist file.

Windows PowerShell:

```powershell
Copy-Item watchlist.example.json watchlist.local.json
```

macOS/Linux:

```bash
cp watchlist.example.json watchlist.local.json
```

5. Fill `.env` with at least:

- `PACIFICA_ENV=testnet`
- `PACIFICA_SYMBOLS=BTC,ETH,SOL`
- `WHALE_NOTIONAL_USD=100000`
- `DEEPSIGNAL_DB_PATH=data/deepsignal.db`
- `DEEPSIGNAL_REPORTS_DIR=reports`
- `DEEPSIGNAL_WATCHLIST_PATH=watchlist.local.json`
- `ELFA_BASE_URL=https://api.elfa.ai`

Optional:

- `PACIFICA_ACCOUNT` for one default tracked account
- `PACIFICA_PRIVATE_KEY` only if you later add signed trading actions
- `ELFA_API_KEY` for live ELFA enrichment
- `ALERT_MIN_SCORE` to control which whale alerts are sent externally
- `ALERT_DEDUP_SECONDS` to suppress near-identical repeated alerts
- `ALERT_SYMBOL_COOLDOWN_SECONDS` to limit symbol-level alert spam
- `ALERT_SUMMARY_THRESHOLD` to emit a compressed summary after repeated suppressed alerts
- `DISCORD_WEBHOOK_URL` for Discord delivery
- `GENERIC_ALERT_WEBHOOK_URL` for a generic JSON webhook

6. Edit `watchlist.local.json` with the Pacifica account addresses you want to track.

7. If you want Privy enabled in the frontend, create a frontend env file:

```bash
cp frontend/.env.example frontend/.env
```

Then fill:

- `VITE_PRIVY_APP_ID`
- `VITE_PRIVY_CLIENT_ID` (optional but recommended)

## How To Run

### 1. Check the base connection

```bash
python -m deepsignal.cli bootstrap
```

This prints current Pacifica market context and confirms the app can start.

### 2. Sync tracked accounts

```bash
python -m deepsignal.cli sync-watchlist
```

This fetches the accounts from `watchlist.local.json` and stores snapshots in your local SQLite database.

### 3. Start the whale monitor

```bash
python -m deepsignal.cli monitor
```

This listens to Pacifica trade data and stores whale alerts locally in `data/deepsignal.db`.

### 4. Generate the dashboard

```bash
python -m deepsignal.cli dashboard
```

Custom time window:

```bash
python -m deepsignal.cli --lookback-hours 72 dashboard
```

This writes a local HTML dashboard to `reports/dashboard.html`.

### 5. Seed demo data

```bash
python -m deepsignal.cli seed-demo
```

This clears stored whale alerts and replaces them with a deterministic demo dataset so you can present the full command center even if live market flow is quiet.

### 6. Build a demo dashboard in one step

```bash
python -m deepsignal.cli demo-dashboard
```

This seeds the deterministic demo dataset, regenerates `reports/dashboard.html`, and exports `frontend/public/terminal-data.json` for the React terminal.

### 7. Run the frontend terminal

```bash
python -m deepsignal.cli dashboard
cd frontend
npm install
npm run dev
```

`dashboard` refreshes the backend export first. The React/Vite terminal then reads `frontend/public/terminal-data.json` so `Live`, `Replay`, and `Demo` can run on real stored data instead of fallback-only demo data.

If `frontend/.env` contains valid Privy values, the `Connect` and `Watchlists` pages will also expose wallet/login flows.

## Recommended Local Workflow

1. Activate your virtual environment.
2. Run `python -m deepsignal.cli bootstrap`
3. Run `python -m deepsignal.cli sync-watchlist`
4. Run `python -m deepsignal.cli monitor`
5. In another terminal, run `python -m deepsignal.cli dashboard`

If your teammate does the same on their machine, both of you can pull and push safely because local state stays out of the repository.

For demo day, the shortest path is:

1. Activate the virtual environment.
2. Run `python -m deepsignal.cli demo-dashboard`
3. Open `reports/dashboard.html`

## Demo Script

Use this flow for a 3 to 5 minute hackathon demo:

1. Start with the problem.
   Explain that Pacifica traders can see price action, but they still struggle to understand which whale events actually matter and why those moves are happening.

2. Introduce DeepSignal in one sentence.
   `DeepSignal is a whale-intelligence command center for Pacifica that detects abnormal flow, ranks it by importance, explains the surrounding narrative, and routes only high-signal alerts.`

3. Open the command center.
   Show `reports/dashboard.html` and start at the top of the page:
   - operations snapshot
   - lookback window
   - total whale notional
   - highest whale score

4. Show ranked market focus.
   Walk through:
   - `Hot Symbols`
   - `Top Ranked Whale Alerts`
   - `Top Symbols By Score`

   Explain that this turns raw trade flow into a prioritized market view instead of a noisy event stream.

5. Show directional intelligence.
   Walk through:
   - `Directional Pressure Map`
   - `Directional Flow`
   - `Pressure Split By Symbol`

   Explain that traders can quickly see whether whales are pressing long or short exposure across the tracked markets.

6. Show the narrative layer.
   Walk through:
   - `Narrative Signals`
   - `Narrative Explainers`

   Explain that ELFA gives context around attention, mentions, and narratives so the user sees not only that a whale moved, but also why the market may be reacting.

7. Show the operational layer.
   Explain that DeepSignal also supports:
   - Discord/webhook alerting
   - score thresholds
   - deduplication
   - cooldowns
   - alert summaries

   This proves the product is not just an analytics page, but something traders could actually run.

8. Close with the value proposition.
   `DeepSignal helps traders react faster by identifying the most important whale events on Pacifica, ranking their importance, and attaching narrative context before the rest of the market catches up.`

## Demo Tips

- If live market flow is quiet, run `python -m deepsignal.cli demo-dashboard` before presenting.
- If you want a more active live monitor, temporarily lower `WHALE_NOTIONAL_USD` in `.env`.
- Keep the story focused on `detect -> rank -> explain -> alert`.
- Do not spend too much time on implementation details unless judges ask.

## How To Fill `.env`

What each variable means and where to get it:

- `PACIFICA_ENV`
  Use `testnet` while building. Switch to `mainnet` only if you intentionally want production endpoints.

- `PACIFICA_REST_URL`
  You can leave this blank. The app now auto-fills it from `PACIFICA_ENV`.
  Defaults:
  - `testnet` -> `https://test-api.pacifica.fi/api/v1`
  - `mainnet` -> `https://api.pacifica.fi/api/v1`

- `PACIFICA_WS_URL`
  You can leave this blank too. The app auto-fills it from `PACIFICA_ENV`.
  Defaults:
  - `testnet` -> `wss://test-ws.pacifica.fi/ws`
  - `mainnet` -> `wss://ws.pacifica.fi/ws`

- `PACIFICA_ACCOUNT`
  Optional. This is a Pacifica account address you want to track by default.
  You can get it from:
  - your Pacifica testnet/mainnet app account page
  - your wallet/account used with Pacifica
  - or just leave it blank and instead put tracked accounts in `watchlist.local.json`

- `PACIFICA_PRIVATE_KEY`
  Optional for the current app. You do not need it for market data, whale monitoring, dashboard generation, or ELFA enrichment.
  You only need it later if you implement signed order placement or account actions using Pacifica's SDK/examples.

- `PACIFICA_SYMBOLS`
  Symbols you want to watch, for example `BTC,ETH,SOL`.
  Choose the markets you want to demo.

- `WHALE_NOTIONAL_USD`
  Your whale threshold. Example: `100000` means alerts start at $100k notional.

- `DEEPSIGNAL_DATA_DIR`
  Local folder for generated app data. `data` is fine.

- `DEEPSIGNAL_DB_PATH`
  Local SQLite file path. `data/deepsignal.db` is fine.

- `DEEPSIGNAL_REPORTS_DIR`
  Local folder for generated dashboards. `reports` is fine.

- `DEEPSIGNAL_WATCHLIST_PATH`
  Local path to your tracked-account file. `watchlist.local.json` is fine.

- `ELFA_BASE_URL`
  Leave as `https://api.elfa.ai`.

- `ELFA_API_KEY`
  Get this from ELFA:
  1. create an account at `https://go.elfa.ai/dev-hackathon`
  2. generate an API key in the developer dashboard
  3. upgrade/unlock the Pay-As-You-Go tier as requested by ELFA
  4. claim the sponsored credits with `https://elfa-ai.typeform.com/elfa-x-pacfica`

Recommended `.env` for your current stage:

```env
PACIFICA_ENV=testnet
PACIFICA_REST_URL=
PACIFICA_WS_URL=
PACIFICA_ACCOUNT=
PACIFICA_PRIVATE_KEY=
PACIFICA_SYMBOLS=BTC,ETH,SOL
WHALE_NOTIONAL_USD=100000
DEEPSIGNAL_DATA_DIR=data
DEEPSIGNAL_DB_PATH=data/deepsignal.db
DEEPSIGNAL_REPORTS_DIR=reports
DEEPSIGNAL_WATCHLIST_PATH=watchlist.local.json
ELFA_BASE_URL=https://api.elfa.ai
ELFA_API_KEY=
```

Also fix your `watchlist.local.json`: replace `replace-with-pacifica-account` with a real Pacifica account, or remove the sample entry until you have one.

## What Step 1, 2, and 3 Now Mean In This Repo

Already implemented:

1. Persistent storage for whale alerts and account snapshots in SQLite
2. Dashboard generation for ranked symbols, hot symbols, directional flow, scored alerts, timeline flow, and tracked accounts
3. Watchlist-based account sync for whale/account analysis

Good next upgrades:

1. Add historical trend charts from stored account balance history
2. Score repeated whale behavior and abnormal bursts
3. Replace the current ELFA placeholder with live enrichment calls
4. Add a proper web UI or alert bot for demo day

## Hackathon Positioning

`DeepSignal helps traders identify abnormal whale flow on Pacifica in real time, store those events, monitor tracked accounts, and enrich market signals with external context.`
