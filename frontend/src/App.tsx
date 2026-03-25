import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  alertInbox,
  eventFeed,
  modes,
  narratives,
  symbols,
  type EventSeverity,
  type EventRecord,
  type Mode,
  type SymbolCard,
  type SymbolKey,
} from "./data/demoData";

type SeverityFilter = EventSeverity | "all";
type SideFilter = EventRecord["side"] | "all";

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
  const [mode, setMode] = useState<Mode>("Demo");
  const [activeSymbol, setActiveSymbol] = useState<SymbolKey>("SOL");
  const [selectedEventId, setSelectedEventId] = useState<string>(eventFeed[0].id);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [minScore, setMinScore] = useState(70);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    setAutoRefresh(mode !== "Demo");
    const firstEvent = getModeEvents(mode)[0];
    if (firstEvent) {
      setSelectedEventId(firstEvent.id);
      setActiveSymbol(firstEvent.symbol);
      setTickerIndex(0);
    }
  }, [mode]);

  const modeEvents = useMemo(() => getModeEvents(mode), [mode]);
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
    () => buildActiveCard(activeSymbol, visibleEvents),
    [activeSymbol, visibleEvents],
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
      <main className="terminal-page">
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
              symbols={symbols}
              activeSymbol={activeSymbol}
              onSelect={setActiveSymbol}
            />
            <div className="split-grid">
              <PressureCard activeSymbol={activeSymbol} events={visibleEvents} />
              <TimelineCard rows={timelineRows} />
            </div>
            <NarrativeDeck activeSymbol={activeSymbol} selectedEvent={selectedEvent} />
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
            <InboxCard events={rankedEvents} />
          </aside>
        </section>
      </main>
    </div>
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
}: {
  activeCard: SymbolCard;
  symbols: SymbolCard[];
  activeSymbol: SymbolKey;
  onSelect: (symbol: SymbolKey) => void;
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
    </section>
  );
}

function PressureCard({ activeSymbol, events }: { activeSymbol: SymbolKey; events: EventRecord[] }) {
  const symbolEvents = events.filter((item) => item.symbol === activeSymbol);
  const row = buildFlowRow(activeSymbol, symbolEvents);
  const allRows = symbols.map((item) => buildFlowRow(item.symbol, events.filter((event) => event.symbol === item.symbol)));
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

function NarrativeDeck({ activeSymbol, selectedEvent }: { activeSymbol: SymbolKey; selectedEvent: EventRecord }) {
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

function InboxCard({ events }: { events: EventRecord[] }) {
  const operationalItems = events.slice(0, 3).map((event, index) => ({
    title: `${event.symbol} ${sideLabels[event.side]}`,
    state: index === 0 ? "priority" : event.severity,
    note: `${event.signal} at ${event.score.toFixed(1)} score with $${Math.round(event.notionalUsd / 1000)}k notional`,
  }));
  const items = operationalItems.length > 0 ? operationalItems : alertInbox;

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

function getModeEvents(mode: Mode) {
  if (mode === "Replay") {
    return [...eventFeed].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  if (mode === "Live") {
    return [...eventFeed].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  return eventFeed;
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

function buildActiveCard(symbol: SymbolKey, events: EventRecord[]) {
  const baseCard = symbols.find((item) => item.symbol === symbol) ?? symbols[0];
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
  const source = events.length > 0 ? events : getModeEvents(mode);
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

export default App;
