import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  fallbackSnapshot,
  modes,
  type EventSeverity,
  type EventRecord,
  type Mode,
  type SymbolCard,
  type SymbolKey,
  type TerminalSnapshot,
} from "./data/demoData";

type SeverityFilter = EventSeverity | "all";
type SideFilter = EventRecord["side"] | "all";
type Route =
  | { page: "home" }
  | { page: "terminal" }
  | { page: "replay" }
  | { page: "symbol"; symbol: SymbolKey };

const signalAttention: Record<EventRecord["signal"], number> = {
  "high-attention": 95,
  "rising-attention": 76,
  "low-attention": 48,
};

const sideLabels: Record<EventRecord["side"], string> = {
  open_long: "Open Long",
  open_short: "Open Short",
  close_long: "Close Long",
  close_short: "Close Short",
};

const modeMeta: Record<
  Mode,
  {
    eyebrow: string;
    title: string;
    copy: string;
    note: string;
  }
> = {
  Live: {
    eyebrow: "Live Pacifica Flow",
    title: "Operate the market, do not just watch it.",
    copy:
      "The terminal promotes the freshest qualifying whale flow first, keeps the tape moving, and highlights where conviction is compounding right now.",
    note: "latest ranked flow",
  },
  Replay: {
    eyebrow: "Replay Engine",
    title: "Reconstruct the move and inspect the turning points.",
    copy:
      "Replay mode walks through the incident tape chronologically so you can explain how positioning, pressure, and narrative stacked into the move.",
    note: "sequence analysis",
  },
  Demo: {
    eyebrow: "DeepSignal Terminal",
    title: "Market intelligence made cinematic.",
    copy:
      "A command center for Pacifica whale flow with ranked alerts, narrative context, and directional pressure that feels more like a live control room than another dashboard.",
    note: "seeded showcase",
  },
};

function App() {
  const [snapshot, setSnapshot] = useState<TerminalSnapshot>(fallbackSnapshot);
  const [route, setRouteState] = useState<Route>(() => parseRoute(window.location.pathname));
  const [mode, setMode] = useState<Mode>("Demo");
  const [activeSymbol, setActiveSymbol] = useState<SymbolKey>("SOL");
  const [selectedEventId, setSelectedEventId] = useState<string>(fallbackSnapshot.eventFeed[0].id);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [minScore, setMinScore] = useState(70);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const setRoute = useNavigate(setRouteState);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      try {
        const response = await fetch("/terminal-data.json", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as TerminalSnapshot;
        if (!cancelled && payload.eventFeed?.length) {
          setSnapshot(payload);
        }
      } catch {
        // Keep the local fallback snapshot when the export has not been generated yet.
      }
    }

    void loadSnapshot();

    const handlePopState = () => {
      setRouteState(parseRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      cancelled = true;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (route.page === "symbol") {
      setActiveSymbol(route.symbol);
    }
  }, [route]);

  useEffect(() => {
    setAutoRefresh(mode !== "Demo");
    const firstEvent = getModeEvents(mode, snapshot.eventFeed)[0];
    if (firstEvent) {
      setSelectedEventId(firstEvent.id);
      setActiveSymbol(firstEvent.symbol);
      setTickerIndex(0);
    }
  }, [mode, snapshot.eventFeed]);

  const modeEvents = useMemo(() => getModeEvents(mode, snapshot.eventFeed), [mode, snapshot.eventFeed]);
  const visibleEvents = useMemo(
    () =>
      modeEvents.filter((event) => {
        const matchesQuery =
          query.trim().length === 0 ||
          event.symbol.toLowerCase().includes(query.trim().toLowerCase()) ||
          event.side.toLowerCase().includes(query.trim().toLowerCase()) ||
          event.signal.toLowerCase().includes(query.trim().toLowerCase());
        const matchesSeverity = severityFilter === "all" || event.severity === severityFilter;
        const matchesSide = sideFilter === "all" || event.side === sideFilter;
        const matchesScore = event.score >= minScore;

        return matchesQuery && matchesSeverity && matchesSide && matchesScore;
      }),
    [minScore, modeEvents, query, severityFilter, sideFilter],
  );
  const tickerEvents = visibleEvents.length > 0 ? visibleEvents : modeEvents;

  const activeCard = useMemo(
    () => buildActiveCard(activeSymbol, visibleEvents, snapshot.symbols),
    [activeSymbol, snapshot.symbols, visibleEvents],
  );
  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? modeEvents[0],
    [modeEvents, selectedEventId, visibleEvents],
  );
  const symbolEvents = useMemo(
    () => visibleEvents.filter((event) => event.symbol === activeSymbol),
    [activeSymbol, visibleEvents],
  );
  const derivedKpis = useMemo(() => buildKpis(visibleEvents, modeMeta[mode].note), [mode, visibleEvents]);
  const timelineRows = useMemo(() => buildTimelineRows(visibleEvents, mode), [mode, visibleEvents]);
  const rankedEvents = useMemo(
    () => [...visibleEvents].sort((left, right) => right.score - left.score),
    [visibleEvents],
  );
  const replaySymbols = useMemo(
    () =>
      snapshot.symbols.map((symbol) => ({
        symbol,
        events: visibleEvents.filter((event) => event.symbol === symbol.symbol),
      })),
    [snapshot.symbols, visibleEvents],
  );

  useEffect(() => {
    if (tickerEvents.length === 0) {
      setTickerIndex(0);
      return;
    }

    setTickerIndex((current) => current % tickerEvents.length);
  }, [tickerEvents]);

  useEffect(() => {
    if (!selectedEvent || !tickerEvents.some((event) => event.id === selectedEvent.id)) {
      const fallbackEvent = tickerEvents[0];
      if (fallbackEvent) {
        setSelectedEventId(fallbackEvent.id);
        setActiveSymbol(fallbackEvent.symbol);
      }
    }
  }, [selectedEvent, tickerEvents]);

  useEffect(() => {
    if (!autoRefresh || tickerEvents.length === 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setTickerIndex((current) => {
        const nextIndex = (current + 1) % tickerEvents.length;
        const nextEvent = tickerEvents[nextIndex];
        if (mode !== "Demo" && nextEvent) {
          setSelectedEventId(nextEvent.id);
          setActiveSymbol(nextEvent.symbol);
        }
        return nextIndex;
      });
    }, mode === "Replay" ? 2600 : 3200);

    return () => window.clearInterval(interval);
  }, [autoRefresh, mode, tickerEvents]);

  return (
    <div className="terminal-shell">
      <AuroraBackground />
      <main className={route.page === "home" ? "landing-page" : "terminal-page"}>
        <TopNav route={route} onNavigate={setRoute} />
        {route.page === "home" ? (
          <LandingPage
            snapshot={snapshot}
            activeCard={activeCard}
            onEnterTerminal={() => setRoute({ page: "terminal" })}
            onOpenReplay={() => setRoute({ page: "replay" })}
            onOpenSymbol={(symbol) => setRoute({ page: "symbol", symbol })}
          />
        ) : null}
        {route.page === "terminal" ? (
          <>
            <HeroSection mode={mode} setMode={setMode} activeCard={activeCard} />
            <ControlsPanel
              query={query}
              severityFilter={severityFilter}
              sideFilter={sideFilter}
              minScore={minScore}
              autoRefresh={autoRefresh}
              onQueryChange={setQuery}
              onSeverityChange={setSeverityFilter}
              onSideChange={setSideFilter}
              onMinScoreChange={setMinScore}
              onAutoRefreshChange={setAutoRefresh}
              onReset={() => {
                setQuery("");
                setSeverityFilter("all");
                setSideFilter("all");
                setMinScore(70);
              }}
            />
            <TickerStrip
              events={tickerEvents}
              tickerIndex={tickerIndex}
              onSelect={(event) => {
                setSelectedEventId(event.id);
                setActiveSymbol(event.symbol);
              }}
            />
            <section className="kpi-grid">
              {derivedKpis.map((item, index) => (
                <motion.article
                  key={item.label}
                  className="kpi-card glass-card"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index, duration: 0.45 }}
                >
                  <span className="eyebrow">{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </motion.article>
              ))}
            </section>
            <section className="terminal-grid">
              <div className="main-column">
                <FocusPanel
                  activeCard={activeCard}
                  symbols={snapshot.symbols}
                  activeSymbol={activeSymbol}
                  onSelect={setActiveSymbol}
                  onOpenSymbol={(symbol) => setRoute({ page: "symbol", symbol })}
                />
                <div className="split-grid">
                  <PressureCard activeSymbol={activeSymbol} events={visibleEvents} baseSymbols={snapshot.symbols} />
                  <TimelineCard rows={timelineRows} />
                </div>
                <NarrativeDeck
                  activeSymbol={activeSymbol}
                  selectedEvent={selectedEvent}
                  narratives={snapshot.narratives}
                />
                <ReplayFeed
                  events={symbolEvents}
                  selectedEventId={selectedEventId}
                  onSelect={setSelectedEventId}
                />
              </div>
              <aside className="side-column">
                <RankedAlerts
                  events={rankedEvents}
                  activeSymbol={activeSymbol}
                  selectedEventId={selectedEventId}
                  onSelect={setSelectedEventId}
                />
                <SignalStack activeCard={activeCard} />
                <InboxCard events={rankedEvents} fallbackItems={snapshot.alertInbox} />
              </aside>
            </section>
          </>
        ) : null}
        {route.page === "symbol" ? (
          <SymbolDetailPage
            card={activeCard}
            events={symbolEvents}
            allSymbols={snapshot.symbols}
            onSelectSymbol={(symbol) => setRoute({ page: "symbol", symbol })}
            onBack={() => setRoute({ page: "terminal" })}
          />
        ) : null}
        {route.page === "replay" ? (
          <ReplayPage
            rows={timelineRows}
            groupedEvents={replaySymbols}
            onOpenSymbol={(symbol) => setRoute({ page: "symbol", symbol })}
          />
        ) : null}
      </main>
    </div>
  );
}

function TopNav({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  return (
    <header className="top-nav">
      <button type="button" className="brand-mark" onClick={() => onNavigate({ page: "home" })}>
        DeepSignal
      </button>
      <nav className="nav-links">
        <button type="button" className={isActiveRoute(route, "home")} onClick={() => onNavigate({ page: "home" })}>
          Home
        </button>
        <button type="button" className={isActiveRoute(route, "terminal")} onClick={() => onNavigate({ page: "terminal" })}>
          Terminal
        </button>
        <button type="button" className={isActiveRoute(route, "replay")} onClick={() => onNavigate({ page: "replay" })}>
          Replay
        </button>
      </nav>
    </header>
  );
}

function LandingPage({
  snapshot,
  activeCard,
  onEnterTerminal,
  onOpenReplay,
  onOpenSymbol,
}: {
  snapshot: TerminalSnapshot;
  activeCard: SymbolCard;
  onEnterTerminal: () => void;
  onOpenReplay: () => void;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  return (
    <>
      <section className="launch-hero glass-card">
        <div className="launch-copy">
          <span className="eyebrow">Pacifica Market Intelligence</span>
          <h1>Detect the move before the market explains it.</h1>
          <p>
            DeepSignal turns Pacifica whale flow into a product people want to explore: a live
            control room for oversized trades, narrative acceleration, and ranked conviction.
          </p>
          <div className="launch-actions">
            <button type="button" className="cta-primary" onClick={onEnterTerminal}>
              Enter Terminal
            </button>
            <button type="button" className="cta-secondary" onClick={onOpenReplay}>
              Open Replay
            </button>
          </div>
          <div className="launch-kpis">
            {snapshot.kpis.map((item) => (
              <article key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="launch-stage">
          <div className="stage-panel glass-card">
            <span className="eyebrow">Current Focus</span>
            <h2>{activeCard.displayName}</h2>
            <p>{activeCard.thesis}</p>
            <div className="stage-metrics">
              <div><span>Hot Score</span><strong>{activeCard.hotScore.toFixed(1)}</strong></div>
              <div><span>Attention</span><strong>{activeCard.attention}</strong></div>
              <div><span>Confidence</span><strong>{activeCard.confidence}</strong></div>
            </div>
          </div>
        </div>
      </section>
      <section className="launch-ticker glass-card">
        <span className="eyebrow">Whale Tape</span>
        <div className="ticker-track">
          {snapshot.eventFeed.slice(0, 4).map((event) => (
            <button
              key={event.id}
              type="button"
              className="ticker-pill active"
              onClick={() => onOpenSymbol(event.symbol)}
            >
              <strong>{event.symbol}</strong>
              <span>{sideLabels[event.side]}</span>
              <span>${Math.round(event.notionalUsd / 1000)}k</span>
              <span>{event.score.toFixed(1)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="discover-grid">
        <article className="discover-card glass-card">
          <span className="eyebrow">Detect</span>
          <h3>Large trades surface immediately</h3>
          <p>Raw Pacifica activity is filtered into qualifying whale flow instead of noisy market tape.</p>
        </article>
        <article className="discover-card glass-card">
          <span className="eyebrow">Rank</span>
          <h3>Priority rises to the top</h3>
          <p>Scores combine size, pressure profile, and context so operators see signal before clutter.</p>
        </article>
        <article className="discover-card glass-card">
          <span className="eyebrow">Explain</span>
          <h3>Narratives make the move legible</h3>
          <p>ELFA context gives each alert a reason, not just a number.</p>
        </article>
        <article className="discover-card glass-card">
          <span className="eyebrow">Route</span>
          <h3>Alerts stay usable</h3>
          <p>Deduplication, cooldowns, and summaries keep operations channels clean.</p>
        </article>
      </section>
      <section className="symbol-gallery">
        {snapshot.symbols.map((symbol) => (
          <button
            key={symbol.symbol}
            type="button"
            className="symbol-showcase glass-card"
            onClick={() => onOpenSymbol(symbol.symbol)}
          >
            <div className="symbol-top">
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

function SymbolDetailPage({
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
  const topEvents = [...events].sort((left, right) => right.score - left.score).slice(0, 4);
  const flow = buildFlowRow(card.symbol, events);

  return (
    <>
      <section className="detail-hero glass-card">
        <div>
          <span className="eyebrow">Symbol Focus</span>
          <h1>{card.displayName}</h1>
          <p>{card.thesis}</p>
        </div>
        <button type="button" className="cta-secondary" onClick={onBack}>
          Back To Terminal
        </button>
      </section>
      <div className="symbol-tabs detail-tabs">
        {allSymbols.map((symbol) => (
          <button
            key={symbol.symbol}
            type="button"
            className={symbol.symbol === card.symbol ? "symbol-tab active" : "symbol-tab"}
            onClick={() => onSelectSymbol(symbol.symbol)}
          >
            {symbol.symbol}
          </button>
        ))}
      </div>
      <section className="detail-grid">
        <article className="glass-card detail-card">
          <span className="eyebrow">Profile</span>
          <h2>Signal profile</h2>
          <div className="detail-metric-grid">
            <div><span>Hot Score</span><strong>{card.hotScore.toFixed(1)}</strong></div>
            <div><span>Attention</span><strong>{card.attention}</strong></div>
            <div><span>Confidence</span><strong>{card.confidence}</strong></div>
            <div><span>Direction</span><strong>{card.direction}</strong></div>
          </div>
        </article>
        <article className="glass-card detail-card">
          <span className="eyebrow">Flow</span>
          <h2>Net pressure</h2>
          <p>{card.dominantFlow}</p>
          <div className="detail-metric-grid">
            <div><span>Bullish</span><strong>${Math.round(flow.bullish / 1000)}k</strong></div>
            <div><span>Bearish</span><strong>${Math.round(flow.bearish / 1000)}k</strong></div>
            <div><span>Events</span><strong>{events.length}</strong></div>
            <div><span>Signal</span><strong>{events[0]?.signal ?? "n/a"}</strong></div>
          </div>
        </article>
      </section>
      <section className="detail-grid">
        <article className="glass-card detail-card">
          <span className="eyebrow">Highlights</span>
          <h2>What stands out</h2>
          <ul className="focus-list">
            {card.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </article>
        <article className="glass-card detail-card">
          <span className="eyebrow">Priority Events</span>
          <h2>Best alerts</h2>
          <div className="event-list">
            {topEvents.map((event) => (
              <article key={event.id} className="event-item active static-item">
                <div><strong>{sideLabels[event.side]}</strong><span>{event.signal}</span></div>
                <div><strong>{event.score.toFixed(1)}</strong><span>${Math.round(event.notionalUsd / 1000)}k</span></div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ReplayPage({
  rows,
  groupedEvents,
  onOpenSymbol,
}: {
  rows: Array<{ hour: string; notional: number; events: number }>;
  groupedEvents: Array<{ symbol: SymbolCard; events: EventRecord[] }>;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  return (
    <>
      <section className="detail-hero glass-card">
        <div>
          <span className="eyebrow">Replay Theater</span>
          <h1>Walk the sequence, not just the score.</h1>
          <p>
            Replay exposes the structure of the move: when activity clustered, which symbols led,
            and how the tape evolved through the window.
          </p>
        </div>
      </section>
      <section className="replay-layout">
        <article className="glass-card detail-card">
          <span className="eyebrow">Pulse</span>
          <h2>Hourly flow</h2>
          <TimelineCard rows={rows} />
        </article>
        <article className="glass-card detail-card">
          <span className="eyebrow">Sequence</span>
          <h2>Symbol lanes</h2>
          <div className="lane-list">
            {groupedEvents.map(({ symbol, events }) => (
              <button key={symbol.symbol} type="button" className="lane-card" onClick={() => onOpenSymbol(symbol.symbol)}>
                <div className="lane-top">
                  <strong>{symbol.symbol}</strong>
                  <span>{events.length} events</span>
                </div>
                <p>{symbol.thesis}</p>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function HeroSection({
  mode,
  setMode,
  activeCard,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  activeCard: SymbolCard;
}) {
  const meta = modeMeta[mode];

  return (
    <section className="hero-terminal glass-card">
      <div className="hero-copy">
        <span className="eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.copy}</p>
        <div className="mode-switch">
          {modes.map((item) => (
            <button
              key={item}
              type="button"
              className={item === mode ? "mode-pill active" : "mode-pill"}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="hero-status">
        <div className="hero-symbol-badge">{activeCard.symbol}</div>
        <strong className="hero-price">{activeCard.price}</strong>
        <div className={activeCard.changePct >= 0 ? "hero-change up" : "hero-change down"}>
          {activeCard.changePct >= 0 ? "+" : ""}
          {activeCard.changePct.toFixed(1)}%
        </div>
        <p>{activeCard.thesis}</p>
      </div>
    </section>
  );
}

function ControlsPanel({
  query,
  severityFilter,
  sideFilter,
  minScore,
  autoRefresh,
  onQueryChange,
  onSeverityChange,
  onSideChange,
  onMinScoreChange,
  onAutoRefreshChange,
  onReset,
}: {
  query: string;
  severityFilter: SeverityFilter;
  sideFilter: SideFilter;
  minScore: number;
  autoRefresh: boolean;
  onQueryChange: (value: string) => void;
  onSeverityChange: (value: SeverityFilter) => void;
  onSideChange: (value: SideFilter) => void;
  onMinScoreChange: (value: number) => void;
  onAutoRefreshChange: (value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <section className="controls-card glass-card">
      <div className="panel-head compact">
        <div>
          <span className="eyebrow">Terminal Controls</span>
          <h3>Filter the tape, then decide what matters.</h3>
        </div>
      </div>
      <div className="controls-grid">
        <label className="field">
          <span>Search</span>
          <input
            type="search"
            value={query}
            placeholder="BTC, open_long, high-attention"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Severity</span>
          <select
            value={severityFilter}
            onChange={(event) => onSeverityChange(event.target.value as SeverityFilter)}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </label>
        <label className="field">
          <span>Side</span>
          <select value={sideFilter} onChange={(event) => onSideChange(event.target.value as SideFilter)}>
            <option value="all">All sides</option>
            {Object.entries(sideLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Minimum score</span>
          <input
            type="range"
            min={60}
            max={100}
            step={1}
            value={minScore}
            onChange={(event) => onMinScoreChange(Number(event.target.value))}
          />
          <strong className="field-value">{minScore}</strong>
        </label>
      </div>
      <div className="controls-footer">
        <label className="toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => onAutoRefreshChange(event.target.checked)}
          />
          <span>Auto-refresh focus</span>
        </label>
        <button type="button" className="reset-button" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </section>
  );
}

function TickerStrip({
  events,
  tickerIndex,
  onSelect,
}: {
  events: EventRecord[];
  tickerIndex: number;
  onSelect: (event: EventRecord) => void;
}) {
  if (events.length === 0) {
    return (
      <section className="ticker-shell glass-card">
        <span className="eyebrow">Live Whale Tape</span>
        <p className="empty-copy">No alerts match the current filters.</p>
      </section>
    );
  }

  return (
    <section className="ticker-shell glass-card">
      <span className="eyebrow">Live Whale Tape</span>
      <div className="ticker-track">
        {events.map((event, index) => (
          <button
            key={event.id}
            type="button"
            className={index === tickerIndex ? "ticker-pill active" : "ticker-pill"}
            onClick={() => onSelect(event)}
          >
            <strong>{event.symbol}</strong>
            <span>{event.side}</span>
            <span>${Math.round(event.notionalUsd / 1000)}k</span>
            <span>{event.score.toFixed(1)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FocusPanel({
  activeCard,
  symbols,
  activeSymbol,
  onSelect,
  onOpenSymbol,
}: {
  activeCard: SymbolCard;
  symbols: SymbolCard[];
  activeSymbol: SymbolKey;
  onSelect: (symbol: SymbolKey) => void;
  onOpenSymbol: (symbol: SymbolKey) => void;
}) {
  return (
    <section className="focus-panel glass-card">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Focus Mode</span>
          <h2>{activeCard.displayName}</h2>
        </div>
        <div className="focus-metrics">
          <div><span>Hot score</span><strong>{activeCard.hotScore.toFixed(1)}</strong></div>
          <div><span>Attention</span><strong>{activeCard.attention}</strong></div>
          <div><span>Confidence</span><strong>{activeCard.confidence}</strong></div>
        </div>
      </div>
      <div className="symbol-tabs">
        {symbols.map((symbol) => (
          <button
            key={symbol.symbol}
            type="button"
            className={symbol.symbol === activeSymbol ? "symbol-tab active" : "symbol-tab"}
            onClick={() => onSelect(symbol.symbol)}
          >
            {symbol.symbol}
          </button>
        ))}
      </div>
      <div className="focus-story">
        <div className="story-block"><span>Dominant Flow</span><strong>{activeCard.dominantFlow}</strong></div>
        <div className="story-block"><span>Direction</span><strong>{activeCard.direction}</strong></div>
      </div>
      <ul className="focus-list">
        {activeCard.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
      </ul>
      <button type="button" className="inline-link" onClick={() => onOpenSymbol(activeCard.symbol)}>
        Open Symbol Briefing
      </button>
    </section>
  );
}

function PressureCard({
  activeSymbol,
  events,
  baseSymbols,
}: {
  activeSymbol: SymbolKey;
  events: EventRecord[];
  baseSymbols: SymbolCard[];
}) {
  const symbolEvents = events.filter((item) => item.symbol === activeSymbol);
  const row = buildFlowRow(activeSymbol, symbolEvents);
  const allRows = activeSymbolUniverse(events, baseSymbols).map((symbol) =>
    buildFlowRow(symbol, events.filter((event) => event.symbol === symbol)),
  );
  const maxAbs = Math.max(...allRows.map((item) => Math.abs(item.net)), 1);
  const pct = (Math.abs(row.net) / maxAbs) * 100;
  const positive = row.net >= 0;

  return (
    <section className="glass-card pressure-card">
      <div className="panel-head compact">
        <div><span className="eyebrow">Directional Pressure</span><h3>{activeSymbol}</h3></div>
      </div>
      <div className="pressure-bars">
        <div><span>Bullish</span><strong>${(row.bullish / 1000).toFixed(0)}k</strong></div>
        <div><span>Bearish</span><strong>${(row.bearish / 1000).toFixed(0)}k</strong></div>
      </div>
      <div className="net-track">
        <motion.div
          className={positive ? "net-fill positive" : "net-fill negative"}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(10, pct)}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className={positive ? "net-copy positive" : "net-copy negative"}>
        {positive ? "+" : "-"}${Math.abs(row.net / 1000).toFixed(0)}k net flow
      </p>
    </section>
  );
}

function TimelineCard({ rows }: { rows: Array<{ hour: string; notional: number; events: number }> }) {
  const maxNotional = Math.max(...rows.map((item) => item.notional), 1);
  return (
    <section className="glass-card timeline-card">
      <div className="panel-head compact">
        <div><span className="eyebrow">Replay Strip</span><h3>Flow Pulse</h3></div>
      </div>
      <div className="timeline-bars">
        {rows.map((item) => (
          <div key={item.hour} className="timeline-bar">
            <span>{item.hour}</span>
            <div className="timeline-track">
              <motion.div
                className="timeline-fill"
                initial={{ height: 0 }}
                animate={{ height: `${(item.notional / maxNotional) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <strong>{item.events}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function NarrativeDeck({
  activeSymbol,
  selectedEvent,
  narratives,
}: {
  activeSymbol: SymbolKey;
  selectedEvent: EventRecord;
  narratives: TerminalSnapshot["narratives"];
}) {
  return (
    <section className="glass-card narrative-deck">
      <div className="panel-head">
        <div><span className="eyebrow">Narrative Deck</span><h2>{activeSymbol} explainer stack</h2></div>
        <div className="signal-badge">{selectedEvent.signal}</div>
      </div>
      <div className="narrative-grid">
        <AnimatePresence mode="wait">
          <motion.article
            key={selectedEvent.id}
            className="narrative-hero"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.3 }}
          >
            <span className="eyebrow">Selected Alert</span>
            <h3>{selectedEvent.symbol} {selectedEvent.side}</h3>
            <p>{selectedEvent.narrative}</p>
            <div className="hero-meta"><strong>{selectedEvent.score.toFixed(1)} score</strong><span>${Math.round(selectedEvent.notionalUsd / 1000)}k notional</span></div>
          </motion.article>
        </AnimatePresence>
        <div className="narrative-list">
          {narratives.map((item) => (
            <article key={item.title} className="narrative-note">
              <h4>{item.title}</h4>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReplayFeed({ events, selectedEventId, onSelect }: { events: EventRecord[]; selectedEventId: string; onSelect: (id: string) => void }) {
  if (events.length === 0) {
    return (
      <section className="glass-card replay-feed">
        <div className="panel-head">
          <div><span className="eyebrow">Incident Feed</span><h2>Replay timeline</h2></div>
        </div>
        <p className="empty-copy">No events remain for the selected symbol under the current filters.</p>
      </section>
    );
  }

  return (
    <section className="glass-card replay-feed">
      <div className="panel-head">
        <div><span className="eyebrow">Incident Feed</span><h2>Replay timeline</h2></div>
      </div>
      <div className="event-list">
        {events.map((event) => (
          <button key={event.id} type="button" className={event.id === selectedEventId ? "event-item active" : "event-item"} onClick={() => onSelect(event.id)}>
            <div><strong>{event.symbol}</strong><span>{event.side}</span></div>
            <div><strong>{event.score.toFixed(1)}</strong><span>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RankedAlerts({
  events,
  activeSymbol,
  selectedEventId,
  onSelect,
}: {
  events: EventRecord[];
  activeSymbol: SymbolKey;
  selectedEventId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="glass-card ranked-card">
      <div className="panel-head">
        <div><span className="eyebrow">Priority Queue</span><h2>Ranked alerts</h2></div>
      </div>
      <div className="ranked-list">
        {events.map((event) => (
          <button key={event.id} type="button" className={event.id === selectedEventId ? "ranked-item active" : "ranked-item"} onClick={() => onSelect(event.id)}>
            <div className="ranked-left"><strong>{event.symbol}</strong><span className={event.symbol === activeSymbol ? "active-dot" : "inactive-dot"} /></div>
            <div className="ranked-main"><span>{event.side}</span><small>{event.signal}</small></div>
            <strong>{event.score.toFixed(1)}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function SignalStack({ activeCard }: { activeCard: SymbolCard }) {
  return (
    <section className="glass-card signal-stack">
      <div className="panel-head"><div><span className="eyebrow">Signal Stack</span><h2>{activeCard.symbol} intelligence</h2></div></div>
      <div className="stack-grid">
        <article><span>Confidence</span><strong>{activeCard.confidence}</strong></article>
        <article><span>Attention</span><strong>{activeCard.attention}</strong></article>
        <article><span>Direction</span><strong>{activeCard.direction}</strong></article>
        <article><span>Hot score</span><strong>{activeCard.hotScore.toFixed(1)}</strong></article>
      </div>
    </section>
  );
}

function InboxCard({
  events,
  fallbackItems,
}: {
  events: EventRecord[];
  fallbackItems: TerminalSnapshot["alertInbox"];
}) {
  const operationalItems = events.slice(0, 3).map((event, index) => ({
    title: `${event.symbol} ${sideLabels[event.side]}`,
    state: index === 0 ? "priority" : event.severity,
    note: `${event.signal} at ${event.score.toFixed(1)} score with $${Math.round(event.notionalUsd / 1000)}k notional`,
  }));
  const items = operationalItems.length > 0 ? operationalItems : fallbackItems;

  return (
    <section className="glass-card inbox-card">
      <div className="panel-head"><div><span className="eyebrow">Operator Inbox</span><h2>Alert operations</h2></div></div>
      <div className="inbox-list">
        {items.map((item) => (
          <article key={item.title} className="inbox-item">
            <div className="inbox-top"><strong>{item.title}</strong><span>{item.state}</span></div>
            <p>{item.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuroraBackground() {
  return (
    <div className="aurora-layer" aria-hidden="true">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />
      <div className="grid-noise" />
    </div>
  );
}

function parseRoute(pathname: string): Route {
  if (pathname === "/terminal") {
    return { page: "terminal" };
  }
  if (pathname === "/replay") {
    return { page: "replay" };
  }
  if (pathname.startsWith("/symbol/")) {
    const symbol = pathname.split("/")[2]?.toUpperCase();
    if (symbol === "BTC" || symbol === "ETH" || symbol === "SOL") {
      return { page: "symbol", symbol };
    }
  }
  return { page: "home" };
}

function useNavigate(onNavigate: (route: Route) => void) {
  return (route: Route) => {
    const path =
      route.page === "home"
        ? "/"
        : route.page === "terminal"
          ? "/terminal"
          : route.page === "replay"
            ? "/replay"
            : `/symbol/${route.symbol.toLowerCase()}`;
    window.history.pushState({}, "", path);
    onNavigate(route);
  };
}

function isActiveRoute(route: Route, page: Route["page"]) {
  return route.page === page ? "nav-link active" : "nav-link";
}

function getModeEvents(mode: Mode, events: EventRecord[]) {
  if (mode === "Replay") {
    return [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  if (mode === "Live") {
    return [...events].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  return events;
}

function buildFlowRow(symbol: SymbolKey, events: EventRecord[]) {
  const bullish = events.reduce((total, event) => {
    return total + (event.side === "open_long" || event.side === "close_short" ? event.notionalUsd : 0);
  }, 0);
  const bearish = events.reduce((total, event) => {
    return total + (event.side === "open_short" || event.side === "close_long" ? event.notionalUsd : 0);
  }, 0);

  return {
    symbol,
    bullish,
    bearish,
    net: bullish - bearish,
  };
}

function buildActiveCard(symbol: SymbolKey, events: EventRecord[], baseSymbols: SymbolCard[]) {
  const baseCard = baseSymbols.find((item) => item.symbol === symbol) ?? baseSymbols[0];
  const symbolEvents = events.filter((event) => event.symbol === symbol);

  if (symbolEvents.length === 0) {
    return baseCard;
  }

  const avgScore = symbolEvents.reduce((total, event) => total + event.score, 0) / symbolEvents.length;
  const avgAttention =
    symbolEvents.reduce((total, event) => total + signalAttention[event.signal], 0) / symbolEvents.length;
  const flow = buildFlowRow(symbol, symbolEvents);
  const direction: SymbolCard["direction"] =
    Math.abs(flow.net) < 50000 ? "mixed" : flow.net > 0 ? "bullish" : "bearish";
  const dominantFlow = `${flow.net >= 0 ? "+" : "-"}$${Math.abs(flow.net / 1000).toFixed(0)}k net ${direction === "mixed" ? "mixed" : direction}`;
  const confidence = Math.round((avgScore * 0.62) + (avgAttention * 0.38));
  const highlights = [
    `${symbolEvents.length} qualifying alert${symbolEvents.length === 1 ? "" : "s"} in current view`,
    `${sideLabels[symbolEvents[0].side]} is the leading trigger right now`,
    `${symbolEvents[0].signal.replace("-", " ")} confirms the current narrative stack`,
  ];

  return {
    ...baseCard,
    hotScore: Number(avgScore.toFixed(1)),
    attention: Math.round(avgAttention),
    direction,
    dominantFlow,
    confidence,
    highlights,
  };
}

function buildKpis(events: EventRecord[], note: string) {
  if (events.length === 0) {
    return [
      { label: "Whale Events", value: "0", note },
      { label: "Tracked Notional", value: "$0", note: "no qualifying flow" },
      { label: "Highest Score", value: "0", note: "filters too narrow" },
      { label: "Attention Spike", value: "0", note: "no narrative signal" },
    ];
  }

  const totalNotional = events.reduce((total, event) => total + event.notionalUsd, 0);
  const highestScore = Math.max(...events.map((event) => event.score));
  const attention = Math.max(...events.map((event) => signalAttention[event.signal]));

  return [
    { label: "Whale Events", value: `${events.length}`, note },
    { label: "Tracked Notional", value: `$${(totalNotional / 1_000_000).toFixed(1)}M`, note: "filtered flow" },
    { label: "Highest Score", value: highestScore.toFixed(1), note: "current tape" },
    { label: "Attention Spike", value: `${attention}`, note: "ELFA momentum proxy" },
  ];
}

function buildTimelineRows(events: EventRecord[], mode: Mode) {
  const source = events.length > 0 ? events : getModeEvents(mode, fallbackSnapshot.eventFeed);
  const buckets = new Map<string, { notional: number; events: number }>();

  for (const event of source) {
    const hour = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const entry = buckets.get(hour) ?? { notional: 0, events: 0 };
    entry.notional += event.notionalUsd;
    entry.events += 1;
    buckets.set(hour, entry);
  }

  return [...buckets.entries()].map(([hour, entry]) => ({
    hour,
    notional: entry.notional,
    events: entry.events,
  }));
}

function activeSymbolUniverse(events: EventRecord[], baseSymbols: SymbolCard[]) {
  const symbols = new Set<SymbolKey>(baseSymbols.map((item) => item.symbol));
  for (const event of events) {
    symbols.add(event.symbol);
  }
  return [...symbols];
}

export default App;
