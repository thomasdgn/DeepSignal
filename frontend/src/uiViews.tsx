import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  type EventRecord,
  modes,
  type Mode,
  type NarrativeCard,
  type SymbolCard,
  type SymbolKey,
  type TerminalSnapshot,
  type InboxItem,
} from "./data/demoData";
import { type PrivyState } from "./privy";
import { activeSymbolUniverse, buildFlowRow, sideLabels, type SeverityFilter, type SideFilter } from "./uiHelpers";

type ProfileSummary = {
  label: string;
  isAuthenticated: boolean;
  watchlistCount: number;
  favoriteSymbols: SymbolKey[];
  lastScopeName: string;
  lastScopeUpdatedAt: string;
  pinnedCount: number;
  inboxCount: number;
};

type PersonalInboxItem = {
  id: string;
  title: string;
  state: string;
  note: string;
};

export function IntroView({ onEnter }: { onEnter: () => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section className="intro-view">
      <div className="intro-copy">
        <span className="eyebrow">Whale Signal</span>
        <h1>Enter the signal before the market gives it a name.</h1>
        <p>
          DeepSignal should feel like discovering a living intelligence object. The whale lands,
          the sonar wakes up, and the product opens like a portal instead of a dashboard.
        </p>
        <div className="intro-copy__legend">
          <span>detect</span>
          <span>rank</span>
          <span>explain</span>
          <span>alert</span>
        </div>
      </div>
      <div className="intro-stage">
        <div className="intro-halo" />
        <div className="intro-rings" />
        <div className="intro-stars" />
        <motion.div
          className="signal-whale"
          initial={{ y: -180, rotate: -6, scale: 0.88 }}
          animate={{ y: ready ? -4 : [-180, -16, -4], rotate: ready ? 0 : [-6, -2, 0], scale: ready ? 1 : [0.88, 1.02, 1] }}
          transition={{ duration: 1.35, ease: "easeOut" }}
        >
          <div className="signal-whale__body" />
          <div className="signal-whale__belly" />
          <div className="signal-whale__tail" />
          <div className="signal-whale__fin" />
          <div className="signal-whale__dorsal" />
          <div className="signal-whale__eye" />
          <div className="signal-whale__echo" />
        </motion.div>
        <div className="signal-altar">
          <div className="altar-line altar-line--a" />
          <div className="altar-line altar-line--b" />
          <div className="altar-line altar-line--c" />
        </div>
        <div className="signal-ripple signal-ripple--a" />
        <div className="signal-ripple signal-ripple--b" />
        <div className="signal-ripple signal-ripple--c" />
        <AnimatePresence>
          {ready ? (
            <motion.button
              type="button"
              className="altar-button"
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35 }}
              onClick={onEnter}
            >
              Follow the whale signal
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

export function ConnectView({
  privy,
  profileSummary,
  onContinue,
  onSkip,
}: {
  privy: PrivyState;
  profileSummary: ProfileSummary;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const accountLabel = useMemo(() => {
    const wallet = privy.user?.wallet?.address;
    if (wallet) {
      return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    }
    const email = privy.user?.email?.address;
    if (email) {
      return email;
    }
    return "No connected identity yet";
  }, [privy.user]);

  return (
    <section className="connect-view panel">
      <div className="connect-main">
        <span className="eyebrow">Portal</span>
        <h1>Pass through the tunnel. Identity comes next, not first.</h1>
        <p>
          This is the future home for Privy. It will own wallet connection, session state, personal
          signal rooms, and watchlists that actually belong to someone. For now, it behaves like a
          soft launch chamber into the product.
        </p>
        <div className="action-row">
          {privy.isConfigured ? (
            privy.authenticated ? (
              <button type="button" className="button-primary" onClick={onContinue}>
                Continue as connected user
              </button>
            ) : (
              <button type="button" className="button-primary" onClick={() => void privy.login()}>
                Connect with Privy
              </button>
            )
          ) : (
            <button type="button" className="button-primary" onClick={onContinue}>
              Enter home
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onContinue}>
            Continue without login
          </button>
          <button type="button" className="button-secondary" onClick={onSkip}>
            Skip to terminal
          </button>
        </div>
        <article className="portal-identity">
          <span className="eyebrow">Identity state</span>
          <strong>{privy.authenticated ? "Connected" : privy.isConfigured ? "Ready to connect" : "Privy not configured yet"}</strong>
          <p>{accountLabel}</p>
        </article>
      </div>
      <div className="portal-cards">
        <article className="portal-card portal-card--profile">
          <strong>Operator profile</strong>
          <p>{profileSummary.label}</p>
          <div className="profile-mini-grid">
            <div><span>Last scope</span><strong>{profileSummary.lastScopeName}</strong></div>
            <div><span>Watchlists</span><strong>{profileSummary.watchlistCount}</strong></div>
          </div>
        </article>
        <article className="portal-card">
          <strong>Privy layer</strong>
          <p>Wallet identity, saved watchlists, custom routes, personal alerts.</p>
        </article>
        <article className="portal-card">
          <strong>User feeling</strong>
          <p>Connecting should feel like opening a world, not completing admin work.</p>
        </article>
        <article className="portal-card">
          <strong>Immediate reward</strong>
          <p>Once connected, users should land inside curated lists, saved plays, and guided flow.</p>
        </article>
      </div>
    </section>
  );
}

export function HomeView({
  snapshot,
  activeCard,
  onOpenTerminal,
  onOpenReplay,
  onOpenWatchlists,
  onOpenSymbol,
}: {
  snapshot: TerminalSnapshot;
  activeCard: SymbolCard;
  onOpenTerminal: () => void;
  onOpenReplay: () => void;
  onOpenWatchlists: () => void;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  return (
    <>
      <section className="home-hero panel">
        <div className="home-copy">
          <span className="eyebrow">Signal playground</span>
          <h1>Read the room, catch the move, and make every panel worth clicking.</h1>
          <p>
            DeepSignal is a whale intelligence product, not just a dashboard. It detects aggressive
            perp flow, ranks what matters, explains the narrative with ELFA, and turns that into an
            experience people actually want to explore.
          </p>
          <div className="action-row">
            <button type="button" className="button-primary" onClick={onOpenTerminal}>
              Dive into live flow
            </button>
            <button type="button" className="button-secondary" onClick={onOpenWatchlists}>
              Open watchlists
            </button>
            <button type="button" className="button-secondary" onClick={onOpenReplay}>
              Replay the move
            </button>
          </div>
        </div>
        <div className="hero-focus-card">
          <span className="eyebrow">Current creature</span>
          <h2>{activeCard.displayName}</h2>
          <p>{activeCard.thesis}</p>
          <div className="orbital-visual">
            <div className="orbital-visual__core">{activeCard.symbol}</div>
            <div className="orbital-visual__ring orbital-visual__ring--a" />
            <div className="orbital-visual__ring orbital-visual__ring--b" />
            <div className="orbital-visual__ring orbital-visual__ring--c" />
          </div>
          <div className="mini-metrics">
            <div><span>Hot</span><strong>{activeCard.hotScore.toFixed(1)}</strong></div>
            <div><span>Attention</span><strong>{activeCard.attention}</strong></div>
            <div><span>Confidence</span><strong>{activeCard.confidence}</strong></div>
          </div>
        </div>
      </section>

      <section className="exploration-deck">
        <article className="panel constellation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Constellation</span>
              <h2>Choose a signal universe</h2>
            </div>
          </div>
          <div className="constellation-map">
            {snapshot.symbols.map((symbol, index) => (
              <button
                key={symbol.symbol}
                type="button"
                className={`constellation-node constellation-node--${index + 1}`}
                onClick={() => onOpenSymbol(symbol.symbol)}
              >
                <strong>{symbol.symbol}</strong>
                <span>{symbol.hotScore.toFixed(1)}</span>
              </button>
            ))}
            <div className="constellation-arc constellation-arc--a" />
            <div className="constellation-arc constellation-arc--b" />
            <div className="constellation-arc constellation-arc--c" />
          </div>
        </article>
        <article className="panel discovery-panel">
          <span className="eyebrow">Inside the product</span>
          <h2>What DeepSignal already does</h2>
          <div className="discovery-grid">
            <article className="discovery-card">
              <strong>Whale scoring</strong>
              <p>Turn raw activity into priority instead of noise.</p>
            </article>
            <article className="discovery-card">
              <strong>ELFA explainers</strong>
              <p>Give each move a social and narrative context layer.</p>
            </article>
            <article className="discovery-card">
              <strong>Operational alerts</strong>
              <p>Deliver important events without flooding the user.</p>
            </article>
            <article className="discovery-card">
              <strong>Replay mode</strong>
              <p>See how the sequence formed, not just how it ended.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="path-grid">
        <button type="button" className="path-card panel" onClick={onOpenTerminal}>
          <span className="eyebrow">Live room</span>
          <h3>See ranked whale flow now</h3>
          <p>Open the main command room and focus on the strongest live signals first.</p>
        </button>
        <button type="button" className="path-card panel" onClick={onOpenWatchlists}>
          <span className="eyebrow">Stash</span>
          <h3>Build a personal signal universe</h3>
          <p>Shape watchlists around conviction, mood, speed, or strange narrative pressure.</p>
        </button>
        <button type="button" className="path-card panel" onClick={onOpenReplay}>
          <span className="eyebrow">Replay</span>
          <h3>Watch how the wave formed</h3>
          <p>See the market move like a sequence, not a static dashboard snapshot.</p>
        </button>
      </section>

      <section className="story-grid">
        <article className="panel story-cluster">
          <span className="eyebrow">Narrative climate</span>
          <h2>Why the board is moving</h2>
          <div className="narrative-stack">
            {snapshot.narratives.map((narrative) => (
              <article key={narrative.title} className="narrative-card">
                <strong>{narrative.title}</strong>
                <p>{narrative.copy}</p>
              </article>
            ))}
          </div>
        </article>
        <article className="panel inbox-cluster">
          <span className="eyebrow">Alert ritual</span>
          <h2>What deserves attention first</h2>
          <div className="inbox-list">
            {snapshot.alertInbox.map((item) => (
              <article key={item.title} className="inbox-card">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.state}</span>
                </div>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="symbol-strip">
        {snapshot.symbols.map((symbol) => (
          <button key={symbol.symbol} type="button" className="symbol-card panel" onClick={() => onOpenSymbol(symbol.symbol)}>
            <div className="symbol-card__top">
              <span className="eyebrow">{symbol.symbol}</span>
              <strong>{symbol.hotScore.toFixed(1)}</strong>
            </div>
            <h3>{symbol.displayName}</h3>
            <p>{symbol.thesis}</p>
          </button>
        ))}
      </section>
    </>
  );
}

export function TerminalView({
  mode,
  setMode,
  activeCard,
  activeSymbol,
  symbols,
  selectedEvent,
  selectedEventId,
  tickerEvents,
  tickerIndex,
  kpis,
  timelineRows,
  symbolEvents,
  rankedEvents,
  query,
  severityFilter,
  sideFilter,
  minScore,
  autoRefresh,
  activeWatchlistId,
  activeWatchlistName,
  watchlists,
  alertInbox,
  pinnedEvents,
  narratives,
  favoriteSymbols,
  onQueryChange,
  onSeverityChange,
  onSideChange,
  onMinScoreChange,
  onAutoRefreshChange,
  onActiveWatchlistChange,
  onReset,
  onSelectSymbol,
  onSelectEvent,
  onTogglePinnedAlert,
  onAddInboxFromEvent,
  onOpenSymbol,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  activeCard: SymbolCard;
  activeSymbol: SymbolKey;
  symbols: SymbolCard[];
  selectedEvent: EventRecord;
  selectedEventId: string;
  tickerEvents: EventRecord[];
  tickerIndex: number;
  kpis: Array<{ label: string; value: string; note: string }>;
  timelineRows: Array<{ hour: string; notional: number; events: number }>;
  symbolEvents: EventRecord[];
  rankedEvents: EventRecord[];
  query: string;
  severityFilter: SeverityFilter;
  sideFilter: SideFilter;
  minScore: number;
  autoRefresh: boolean;
  activeWatchlistId: string;
  activeWatchlistName: string;
  watchlists: Array<{ id: string; name: string }>;
  alertInbox: InboxItem[];
  pinnedEvents: EventRecord[];
  narratives: NarrativeCard[];
  favoriteSymbols: SymbolKey[];
  onQueryChange: (value: string) => void;
  onSeverityChange: (value: SeverityFilter) => void;
  onSideChange: (value: SideFilter) => void;
  onMinScoreChange: (value: number) => void;
  onAutoRefreshChange: (value: boolean) => void;
  onActiveWatchlistChange: (value: string) => void;
  onReset: () => void;
  onSelectSymbol: (symbol: SymbolKey) => void;
  onSelectEvent: (id: string) => void;
  onTogglePinnedAlert: (id: string) => void;
  onAddInboxFromEvent: (id: string) => void;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  const flow = buildFlowRow(activeSymbol, symbolEvents);
  const maxTimeline = Math.max(...timelineRows.map((item) => item.notional), 1);
  const topNarratives = narratives.slice(0, 3);

  return (
    <>
      <section className="terminal-hero panel">
        <div className="terminal-hero__copy">
          <span className="eyebrow">Command room</span>
          <h1>{mode === "Replay" ? "Rebuild the wave." : mode === "Live" ? "Watch the ocean move." : "Play with the signal stack."}</h1>
          <p>{activeCard.thesis}</p>
          <div className="scope-chip">
            <span className="eyebrow">Scope</span>
            <strong>{activeWatchlistName}</strong>
          </div>
          <div className="mode-tabs">
            {modes.map((item) => (
              <button key={item} type="button" className={item === mode ? "mode-tab active" : "mode-tab"} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="terminal-hero__focus">
          <span className="eyebrow">{activeCard.symbol}</span>
          <strong>{activeCard.hotScore.toFixed(1)}</strong>
          <p>{activeCard.dominantFlow}</p>
        </div>
      </section>

      <section className="filter-bar panel">
        <label><span>Search</span><input type="search" value={query} placeholder="BTC, open long..." onChange={(event) => onQueryChange(event.target.value)} /></label>
        <label>
          <span>Watchlist</span>
          <select value={activeWatchlistId} onChange={(event) => onActiveWatchlistChange(event.target.value)}>
            <option value="all">All signals</option>
            {watchlists.map((watchlist) => (
              <option key={watchlist.id} value={watchlist.id}>{watchlist.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={severityFilter} onChange={(event) => onSeverityChange(event.target.value as SeverityFilter)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </label>
        <label>
          <span>Side</span>
          <select value={sideFilter} onChange={(event) => onSideChange(event.target.value as SideFilter)}>
            <option value="all">All</option>
            {Object.entries(sideLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label><span>Min score</span><input type="range" min={60} max={100} value={minScore} onChange={(event) => onMinScoreChange(Number(event.target.value))} /></label>
        <button type="button" className="button-secondary" onClick={onReset}>Reset</button>
        <button type="button" className="button-secondary" onClick={() => onAutoRefreshChange(!autoRefresh)}>
          {autoRefresh ? "Auto on" : "Auto off"}
        </button>
      </section>

      <section className="ticker-row panel">
        {tickerEvents.map((event, index) => (
          <button key={event.id} type="button" className={index === tickerIndex ? "ticker-card active" : "ticker-card"} onClick={() => onSelectEvent(event.id)}>
            <strong>{event.symbol}</strong>
            <span>{sideLabels[event.side]}</span>
            <span>${Math.round(event.notionalUsd / 1000)}k</span>
          </button>
        ))}
      </section>

      <section className="kpi-row">
        {kpis.map((item) => (
          <article key={item.label} className="kpi-box panel">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="terminal-layout">
        <div className="terminal-main">
          <article className="panel focus-board">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Focus</span>
                <h2>{activeCard.displayName}</h2>
              </div>
              <button type="button" className="button-secondary" onClick={() => onOpenSymbol(activeCard.symbol)}>
                Open symbol
              </button>
            </div>
            <div className="symbol-pills">
              {symbols.map((symbol) => (
                <button key={symbol.symbol} type="button" className={symbol.symbol === activeSymbol ? "symbol-pill active" : "symbol-pill"} onClick={() => onSelectSymbol(symbol.symbol)}>
                  {symbol.symbol}
                </button>
              ))}
            </div>
            <ul className="insight-list">
              {activeCard.highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="signal-atlas">
              <div className="signal-atlas__center">{activeCard.symbol}</div>
              <div className="signal-atlas__orbit signal-atlas__orbit--a" />
              <div className="signal-atlas__orbit signal-atlas__orbit--b" />
              <div className="signal-atlas__orbit signal-atlas__orbit--c" />
            </div>
          </article>

          <div className="dual-panels">
            <article className="panel pressure-board">
              <span className="eyebrow">Pressure</span>
              <h3>{activeSymbol} balance</h3>
              <div className="pressure-stats">
                <div><span>Bullish</span><strong>${Math.round(flow.bullish / 1000)}k</strong></div>
                <div><span>Bearish</span><strong>${Math.round(flow.bearish / 1000)}k</strong></div>
              </div>
              <div className="pressure-track"><div className={flow.net >= 0 ? "pressure-fill positive" : "pressure-fill negative"} style={{ width: `${Math.min(100, Math.max(12, Math.abs(flow.net) / 12_000))}%` }} /></div>
            </article>
            <article className="panel timeline-board">
              <span className="eyebrow">Pulse</span>
              <h3>Timeline</h3>
              <div className="timeline-mini">
                {timelineRows.map((row) => (
                  <div key={row.hour} className="timeline-mini__item">
                    <span>{row.hour}</span>
                    <div className="timeline-mini__bar"><div style={{ height: `${(row.notional / maxTimeline) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="panel story-board">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Narrative</span>
                <h2>{selectedEvent.symbol} {sideLabels[selectedEvent.side]}</h2>
              </div>
              <div className="signal-pill">{selectedEvent.signal}</div>
            </div>
            <p className="story-copy">{selectedEvent.narrative}</p>
            <div className="narrative-tags">
              <span>{selectedEvent.severity}</span>
              <span>{selectedEvent.signal}</span>
              <span>${Math.round(selectedEvent.notionalUsd / 1000)}k</span>
            </div>
            <div className="event-stack">
              {symbolEvents.map((event) => (
                <button key={event.id} type="button" className={event.id === selectedEventId ? "event-stack__item active" : "event-stack__item"} onClick={() => onSelectEvent(event.id)}>
                  <strong>{sideLabels[event.side]}</strong>
                  <span>{event.score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </article>

          <section className="signal-lower-grid">
            <article className="panel narrative-board">
              <span className="eyebrow">Narrative deck</span>
              <h2>Explanation layer</h2>
              <div className="narrative-stack">
                {topNarratives.map((narrative) => (
                  <article key={narrative.title} className="narrative-card">
                    <strong>{narrative.title}</strong>
                    <p>{narrative.copy}</p>
                  </article>
                ))}
              </div>
            </article>
            <article className="panel inbox-board">
              <span className="eyebrow">Inbox</span>
              <h2>Operational queue</h2>
              <div className="inbox-list">
                {alertInbox.map((item) => (
                  <article key={item.title} className="inbox-card">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.state}</span>
                    </div>
                    <p>{item.note}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>
        </div>

        <aside className="terminal-side">
          <article className="panel ranked-board">
            <span className="eyebrow">Priority queue</span>
            <h2>Best alerts</h2>
            <div className="ranked-list">
              {rankedEvents.map((event) => (
                <article key={event.id} className={event.id === selectedEventId ? "ranked-list__item active ranked-list__item--interactive" : "ranked-list__item ranked-list__item--interactive"}>
                  <button type="button" className="ranked-list__main" onClick={() => onSelectEvent(event.id)}>
                    <div><strong>{event.symbol}</strong><span>{event.signal}</span></div>
                    <strong>{event.score.toFixed(1)}</strong>
                  </button>
                  <div className="ranked-list__actions">
                    <button type="button" className={favoriteSymbols.includes(event.symbol) ? "mini-chip active" : "mini-chip"} onClick={() => onSelectSymbol(event.symbol)}>
                      {favoriteSymbols.includes(event.symbol) ? "Favorite" : "Focus"}
                    </button>
                    <button type="button" className={pinnedEvents.some((item) => item.id === event.id) ? "mini-chip active" : "mini-chip"} onClick={() => onTogglePinnedAlert(event.id)}>
                      {pinnedEvents.some((item) => item.id === event.id) ? "Pinned" : "Pin"}
                    </button>
                    <button type="button" className="mini-chip" onClick={() => onAddInboxFromEvent(event.id)}>
                      Inbox
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}

export function WatchlistsView({
  privy,
  profileSummary,
  symbols,
  events,
  savedWatchlists,
  activeWatchlistId,
  favoriteSymbols,
  pinnedEvents,
  personalInbox,
  onCreateWatchlist,
  onToggleWatchlistSymbol,
  onRemoveWatchlist,
  onActivateWatchlist,
  onToggleFavoriteSymbol,
  onTogglePinnedAlert,
  onCycleInboxState,
  onAddInboxFromEvent,
  onOpenSymbol,
}: {
  privy: PrivyState;
  profileSummary: ProfileSummary;
  symbols: SymbolCard[];
  events: EventRecord[];
  savedWatchlists: Array<{ id: string; name: string; description: string; symbols: SymbolKey[] }>;
  activeWatchlistId: string;
  favoriteSymbols: SymbolKey[];
  pinnedEvents: EventRecord[];
  personalInbox: PersonalInboxItem[];
  onCreateWatchlist: (name: string, description: string, symbols: SymbolKey[]) => void;
  onToggleWatchlistSymbol: (watchlistId: string, symbol: SymbolKey) => void;
  onRemoveWatchlist: (watchlistId: string) => void;
  onActivateWatchlist: (watchlistId: string) => void;
  onToggleFavoriteSymbol: (symbol: SymbolKey) => void;
  onTogglePinnedAlert: (eventId: string) => void;
  onCycleInboxState: (inboxId: string) => void;
  onAddInboxFromEvent: (eventId: string) => void;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  const collections = [
    { title: "Fast creatures", copy: "Signals that move quickly and keep drawing attention.", items: [...symbols].sort((a, b) => b.hotScore - a.hotScore).slice(0, 3) },
    { title: "Narrative drift", copy: "Names where attention is starting to drag price into a story.", items: [...symbols].sort((a, b) => b.attention - a.attention).slice(0, 3) },
    { title: "Chaotic maybe", copy: "Symbols to keep because they feel interesting, unstable, or just weird.", items: [...symbols].slice(0, 3) },
  ];
  const pinnedSignals = pinnedEvents.length > 0 ? pinnedEvents : events.slice(0, 6);
  const savedPresets = [
    { title: "Momentum room", note: "High-score continuation setups and social confirmation.", symbols: ["SOL", "BTC"] as SymbolKey[] },
    { title: "Whale ambush", note: "Large notional bursts that deserve immediate operator review.", symbols: ["BTC", "ETH"] as SymbolKey[] },
    { title: "Narrative radar", note: "ELFA-heavy symbols where story and price start syncing.", symbols: ["ETH", "SOL"] as SymbolKey[] },
  ];
  const userLabel = useMemo(() => {
    const email = privy.user?.email?.address;
    if (email) {
      return email;
    }
    const wallet = privy.user?.wallet?.address;
    if (wallet) {
      return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    }
    return "Guest operator";
  }, [privy.user]);

  return (
    <>
      <section className="watchlists-hero panel">
        <span className="eyebrow">Personal stash</span>
        <h1>Watchlists should feel collectible, personal, and alive.</h1>
        <p>This page is the future anchor for Privy: identity, saved collections, collaborative signal rooms, and a front door tailored to each user.</p>
      </section>
      <section className="profile-summary-grid">
        <article className="panel profile-summary-card">
          <span className="eyebrow">Profile layer</span>
          <h2>{profileSummary.label}</h2>
            <div className="profile-summary-metrics">
              <div><span>Status</span><strong>{profileSummary.isAuthenticated ? "Connected" : "Guest mode"}</strong></div>
              <div><span>Saved lists</span><strong>{profileSummary.watchlistCount}</strong></div>
              <div><span>Last scope</span><strong>{profileSummary.lastScopeName}</strong></div>
              <div><span>Last sync</span><strong>{new Date(profileSummary.lastScopeUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
              <div><span>Pinned alerts</span><strong>{profileSummary.pinnedCount}</strong></div>
              <div><span>Personal inbox</span><strong>{profileSummary.inboxCount}</strong></div>
            </div>
          </article>
        <article className="panel profile-summary-card">
          <span className="eyebrow">Favorite symbols</span>
          <h2>Current signal habits</h2>
          <div className="profile-favorites-row">
            {profileSummary.favoriteSymbols.length > 0 ? (
              profileSummary.favoriteSymbols.map((symbol) => (
                <button key={`favorite-${symbol}`} type="button" className="watchlist-symbol-chip active" onClick={() => onOpenSymbol(symbol)}>
                  {symbol}
                </button>
              ))
            ) : (
              <span className="profile-empty-copy">Create or edit a watchlist to build favorites.</span>
            )}
          </div>
        </article>
      </section>
      <section className="watchlists-top-grid">
        <article className="panel mood-panel">
          <span className="eyebrow">Favorite layer</span>
          <h2>Shape your signal taste</h2>
          <p className="story-copy">Pick the symbols you want to see again and again. This becomes the quick memory of the product for each operator.</p>
          <div className="watchlist-symbol-editor">
            {symbols.map((symbol) => {
              const active = favoriteSymbols.includes(symbol.symbol);
              return (
                <button
                  key={`favorite-toggle-${symbol.symbol}`}
                  type="button"
                  className={active ? "watchlist-symbol-chip active" : "watchlist-symbol-chip"}
                  onClick={() => onToggleFavoriteSymbol(symbol.symbol)}
                >
                  {active ? `Starred ${symbol.symbol}` : `Star ${symbol.symbol}`}
                </button>
              );
            })}
          </div>
        </article>
        <article className="panel pinboard-panel">
          <span className="eyebrow">Personal inbox</span>
          <h2>Things you want to keep warm</h2>
          <div className="personal-inbox-grid">
            {personalInbox.map((item) => (
              <article key={item.id} className="inbox-card">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.state}</span>
                </div>
                <p>{item.note}</p>
                <button type="button" className="mini-chip" onClick={() => onCycleInboxState(item.id)}>
                  Cycle state
                </button>
              </article>
            ))}
          </div>
        </article>
      </section>
      <section className="watchlists-command-grid">
        <article className="panel watchlists-command-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Future profile</span>
              <h2>Your signal home</h2>
            </div>
            {privy.authenticated ? (
              <button type="button" className="button-primary" onClick={() => onCreateWatchlist("Custom signal room", "A personal watchlist for the current operator.", [symbols[0]?.symbol ?? "BTC"])}>
                Create watchlist
              </button>
            ) : (
              <button type="button" className="button-primary" onClick={() => void privy.login()}>
                Connect to save
              </button>
            )}
          </div>
          <div className="watchlists-command-body">
            <div className="watchlists-avatar-orbit">
              <div className="watchlists-avatar-orbit__core">{privy.authenticated ? "You" : "Guest"}</div>
              <div className="watchlists-avatar-orbit__ring watchlists-avatar-orbit__ring--a" />
              <div className="watchlists-avatar-orbit__ring watchlists-avatar-orbit__ring--b" />
              <div className="watchlists-avatar-orbit__ring watchlists-avatar-orbit__ring--c" />
            </div>
            <div className="watchlists-command-copy">
              <p>Privy plugs into this space to store identity, saved lists, favorite symbols, personal filters, and a reusable signal workflow.</p>
              <div className="watchlists-user-chip">
                <strong>{userLabel}</strong>
                <span>{privy.authenticated ? "watchlists can be persisted" : "connect to save this space"}</span>
              </div>
              <ul className="insight-list">
                <li>saved watchlists by mood, setup, or timeframe</li>
                <li>private and collaborative signal rooms</li>
                <li>persistent filters and operator preferences</li>
              </ul>
            </div>
          </div>
        </article>
        <article className="panel watchlists-preset-panel">
          <span className="eyebrow">Starter presets</span>
          <h2>Collections people will want to keep</h2>
          <div className="preset-grid">
            {savedPresets.map((preset) => (
              <article key={preset.title} className="preset-card">
                <strong>{preset.title}</strong>
                <p>{preset.note}</p>
                {privy.authenticated ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => onCreateWatchlist(preset.title, preset.note, preset.symbols)}
                  >
                    Add preset
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </section>
      <section className="saved-watchlists-grid">
        {savedWatchlists.map((watchlist) => (
          <article key={watchlist.id} className="panel saved-watchlist-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Saved room</span>
                <h2>{watchlist.name}</h2>
              </div>
              <div className="watchlist-actions">
                <button type="button" className={activeWatchlistId === watchlist.id ? "button-primary" : "button-secondary"} onClick={() => onActivateWatchlist(watchlist.id)}>
                  {activeWatchlistId === watchlist.id ? "Active in terminal" : "Focus in terminal"}
                </button>
                {privy.authenticated ? (
                  <button type="button" className="button-secondary" onClick={() => onRemoveWatchlist(watchlist.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <p>{watchlist.description}</p>
            <div className="watchlist-symbol-editor">
              {symbols.map((symbol) => {
                const active = watchlist.symbols.includes(symbol.symbol);
                return (
                  <button
                    key={`${watchlist.id}-${symbol.symbol}`}
                    type="button"
                    className={active ? "watchlist-symbol-chip active" : "watchlist-symbol-chip"}
                    onClick={() => onToggleWatchlistSymbol(watchlist.id, symbol.symbol)}
                  >
                    {symbol.symbol}
                  </button>
                );
              })}
            </div>
            <div className="watchlist-linked-symbols">
              {watchlist.symbols.map((symbol) => (
                <button key={`${watchlist.id}-link-${symbol}`} type="button" className="stash-card" onClick={() => onOpenSymbol(symbol)}>
                  <div><strong>{symbol}</strong><span>Open room</span></div>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
      <section className="watchlists-top-grid">
        <article className="panel mood-panel">
          <span className="eyebrow">Collection moods</span>
          <div className="mood-ribbons">
            <div className="mood-ribbon"><strong>High conviction</strong><span>trend continuation and heavy open-long flow</span></div>
            <div className="mood-ribbon"><strong>Fast reaction</strong><span>symbols to keep open during live sessions</span></div>
            <div className="mood-ribbon"><strong>Experimental</strong><span>odd moves worth replaying later</span></div>
          </div>
        </article>
        <article className="panel pinboard-panel">
          <span className="eyebrow">Pinned now</span>
          <div className="pinboard-grid">
            {pinnedSignals.map((event) => (
              <article key={event.id} className="pin-card">
                <div className="pin-card__top">
                  <strong>{event.symbol}</strong>
                  <span>{event.score.toFixed(1)}</span>
                </div>
                <p>{event.narrative}</p>
                <div className="pin-card__actions">
                  <button type="button" className="mini-chip" onClick={() => onTogglePinnedAlert(event.id)}>
                    {pinnedEvents.some((item) => item.id === event.id) ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" className="mini-chip" onClick={() => onAddInboxFromEvent(event.id)}>
                    Send to inbox
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
      <section className="watchlists-board">
        {collections.map((collection) => (
          <article key={collection.title} className="watchlist-column panel">
            <span className="eyebrow">{collection.title}</span>
            <p>{collection.copy}</p>
            <div className="watchlist-column__items">
              {collection.items.map((symbol) => (
                <button key={`${collection.title}-${symbol.symbol}`} type="button" className="stash-card" onClick={() => onOpenSymbol(symbol.symbol)}>
                  <div><strong>{symbol.symbol}</strong><span>{symbol.hotScore.toFixed(1)}</span></div>
                  <p>{symbol.thesis}</p>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
      <section className="watchlists-footer">
        <article className="panel playful-note">
          <span className="eyebrow">Privy next</span>
          <h2>Save your own signal universe</h2>
          <ul className="insight-list">
            <li>watchlists tied to a connected user</li>
            <li>saved moods, filters, and alert styles</li>
            <li>a personal front door into the product</li>
          </ul>
        </article>
        <article className="panel playful-note">
          <span className="eyebrow">Live queue</span>
          <h2>Signals worth pinning</h2>
          <div className="ranked-list">
            {events.slice(0, 4).map((event) => (
              <article key={event.id} className="ranked-list__item active static">
                <div><strong>{event.symbol}</strong><span>{sideLabels[event.side]}</span></div>
                <strong>{event.score.toFixed(1)}</strong>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

export function ReplayView({
  rows,
  groupedEvents,
  onOpenSymbol,
}: {
  rows: Array<{ hour: string; notional: number; events: number }>;
  groupedEvents: Array<{ symbol: SymbolCard; events: EventRecord[] }>;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  const maxNotional = Math.max(...rows.map((row) => row.notional), 1);
  const orderedLanes = [...groupedEvents].sort((left, right) => right.events.length - left.events.length);

  return (
    <>
      <section className="replay-hero panel">
        <span className="eyebrow">Replay</span>
        <h1>See the move unfold like an incident report, not a dead chart.</h1>
      </section>
      <section className="replay-layout">
        <article className="panel replay-panel">
          <span className="eyebrow">Pulse map</span>
          <h2>Wave timeline</h2>
          <div className="timeline-mini">
            {rows.map((row) => (
              <div key={row.hour} className="timeline-mini__item">
                <span>{row.hour}</span>
                <div className="timeline-mini__bar"><div style={{ height: `${(row.notional / maxNotional) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>
        <article className="panel replay-panel">
          <span className="eyebrow">Lanes</span>
          <h2>Symbol incident lanes</h2>
          <div className="watchlist-column__items">
            {orderedLanes.map(({ symbol, events }) => (
              <button key={symbol.symbol} type="button" className="stash-card" onClick={() => onOpenSymbol(symbol.symbol)}>
                <div><strong>{symbol.symbol}</strong><span>{events.length} events</span></div>
                <p>{symbol.thesis}</p>
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="replay-story-grid">
        {orderedLanes.map(({ symbol, events }) => (
          <article key={symbol.symbol} className="panel replay-story-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{symbol.symbol}</span>
                <h2>{symbol.displayName}</h2>
              </div>
              <button type="button" className="button-secondary" onClick={() => onOpenSymbol(symbol.symbol)}>
                Open room
              </button>
            </div>
            <p>{symbol.thesis}</p>
            <div className="replay-event-row">
              {events.slice(0, 4).map((event) => (
                <article key={event.id} className="replay-event-pill">
                  <strong>{sideLabels[event.side]}</strong>
                  <span>{event.score.toFixed(1)}</span>
                </article>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export function SymbolView({
  card,
  events,
  allSymbols,
  onSelectSymbol,
  onBack,
}: {
  card: SymbolCard;
  events: EventRecord[];
  allSymbols: SymbolCard[];
  onSelectSymbol: (symbol: SymbolKey) => void;
  onBack: () => void;
}) {
  const topEvents = [...events].sort((a, b) => b.score - a.score).slice(0, 4);

  return (
    <>
      <section className="symbol-hero panel">
        <div>
          <span className="eyebrow">Symbol room</span>
          <h1>{card.displayName}</h1>
          <p>{card.thesis}</p>
        </div>
        <button type="button" className="button-secondary" onClick={onBack}>Back to terminal</button>
      </section>
      <div className="symbol-pills">
        {allSymbols.map((symbol) => (
          <button key={symbol.symbol} type="button" className={symbol.symbol === card.symbol ? "symbol-pill active" : "symbol-pill"} onClick={() => onSelectSymbol(symbol.symbol)}>
            {symbol.symbol}
          </button>
        ))}
      </div>
      <section className="watchlists-footer">
        <article className="panel playful-note">
          <span className="eyebrow">Profile</span>
          <h2>{card.symbol} pulse</h2>
          <div className="mini-metrics">
            <div><span>Hot</span><strong>{card.hotScore.toFixed(1)}</strong></div>
            <div><span>Attention</span><strong>{card.attention}</strong></div>
            <div><span>Confidence</span><strong>{card.confidence}</strong></div>
          </div>
          <ul className="insight-list">
            {card.highlights.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="detail-signal-meter">
            <div className="detail-signal-meter__orb">{card.symbol}</div>
            <div className="detail-signal-meter__track">
              <div style={{ width: `${card.hotScore}%` }} />
            </div>
          </div>
        </article>
        <article className="panel playful-note">
          <span className="eyebrow">Best alerts</span>
          <h2>Signal picks</h2>
          <div className="ranked-list">
            {topEvents.map((event) => (
              <article key={event.id} className="ranked-list__item active static">
                <div><strong>{sideLabels[event.side]}</strong><span>{event.signal}</span></div>
                <strong>{event.score.toFixed(1)}</strong>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

export function useNoiseAccent(symbols: SymbolCard[]) {
  return activeSymbolUniverse(
    symbols.map((symbol, index) => ({
      id: `ghost-${index}`,
      symbol: symbol.symbol,
      side: "open_long" as const,
      severity: "medium" as const,
      score: symbol.hotScore,
      notionalUsd: symbol.hotScore * 1000,
      timestamp: new Date().toISOString(),
      narrative: symbol.thesis,
      signal: "rising-attention" as const,
    })),
    symbols,
  );
}
