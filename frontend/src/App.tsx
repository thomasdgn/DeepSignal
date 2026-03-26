import { useEffect, useMemo, useState } from "react";
import { fallbackSnapshot, type Mode, type SymbolKey, type TerminalSnapshot } from "./data/demoData";
import { useDeepSignalPrivy } from "./privy";
import { AppFrame, AnimatedPage, TopNav, TunnelTransition } from "./uiFrame";
import { ConnectView, HomeView, IntroView, ReplayView, SymbolView, TerminalView, WatchlistsView } from "./uiViews";
import {
  buildActiveCard,
  buildKpis,
  buildTimelineRows,
  getModeEvents,
  parseRoute,
  routeToPath,
  type AccentTheme,
  type Route,
  type SeverityFilter,
  type SideFilter,
  type ThemeMode,
} from "./uiHelpers";

function App() {
  const privy = useDeepSignalPrivy();
  const [snapshot, setSnapshot] = useState<TerminalSnapshot>(fallbackSnapshot);
  const [route, setRouteState] = useState<Route>(() => parseRoute(window.location.pathname));
  const [themeMode, setThemeMode] = useState<ThemeMode>("night");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("blue");
  const [mode, setMode] = useState<Mode>("Demo");
  const [activeSymbol, setActiveSymbol] = useState<SymbolKey>("SOL");
  const [selectedEventId, setSelectedEventId] = useState<string>(fallbackSnapshot.eventFeed[0].id);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [minScore, setMinScore] = useState(70);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tunnelTarget, setTunnelTarget] = useState<Route | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("deepsignal-theme-mode");
    const storedAccent = window.localStorage.getItem("deepsignal-accent-theme");
    if (storedTheme === "night" || storedTheme === "day") {
      setThemeMode(storedTheme);
    }
    if (storedAccent === "blue" || storedAccent === "red") {
      setAccentTheme(storedAccent);
    }
  }, []);

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
        // Keep fallback snapshot if export is not present yet.
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
    window.localStorage.setItem("deepsignal-theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("deepsignal-accent-theme", accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    if (!tunnelTarget) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      navigateTo(tunnelTarget);
      setTunnelTarget(null);
    }, 950);
    return () => window.clearTimeout(timeout);
  }, [tunnelTarget]);

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
        const needle = query.trim().toLowerCase();
        const matchesQuery =
          needle.length === 0 ||
          event.symbol.toLowerCase().includes(needle) ||
          event.side.toLowerCase().includes(needle) ||
          event.signal.toLowerCase().includes(needle);
        const matchesSeverity = severityFilter === "all" || event.severity === severityFilter;
        const matchesSide = sideFilter === "all" || event.side === sideFilter;
        return matchesQuery && matchesSeverity && matchesSide && event.score >= minScore;
      }),
    [modeEvents, minScore, query, severityFilter, sideFilter],
  );
  const tickerEvents = visibleEvents.length > 0 ? visibleEvents : modeEvents;
  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? modeEvents[0],
    [modeEvents, selectedEventId, visibleEvents],
  );
  const symbolEvents = useMemo(
    () => visibleEvents.filter((event) => event.symbol === activeSymbol),
    [activeSymbol, visibleEvents],
  );
  const rankedEvents = useMemo(
    () => [...visibleEvents].sort((left, right) => right.score - left.score),
    [visibleEvents],
  );
  const activeCard = useMemo(
    () => buildActiveCard(activeSymbol, visibleEvents, snapshot.symbols),
    [activeSymbol, snapshot.symbols, visibleEvents],
  );
  const kpis = useMemo(() => buildKpis(visibleEvents, mode === "Live" ? "live flow" : mode === "Replay" ? "sequence view" : "playground"), [mode, visibleEvents]);
  const timelineRows = useMemo(() => buildTimelineRows(visibleEvents.length > 0 ? visibleEvents : modeEvents), [modeEvents, visibleEvents]);
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

  function navigateTo(nextRoute: Route) {
    window.history.pushState({}, "", routeToPath(nextRoute));
    setRouteState(nextRoute);
  }

  return (
    <AppFrame themeMode={themeMode} accentTheme={accentTheme}>
      <TunnelTransition active={tunnelTarget !== null} />
      <main className={route.page === "intro" ? "page page-intro" : "page"}>
        {route.page !== "intro" ? (
          <TopNav
            route={route}
            onNavigate={navigateTo}
            themeMode={themeMode}
            accentTheme={accentTheme}
            onToggleTheme={() => setThemeMode((current) => (current === "night" ? "day" : "night"))}
            onToggleAccent={() => setAccentTheme((current) => (current === "blue" ? "red" : "blue"))}
          />
        ) : null}

        {route.page === "intro" ? <AnimatedPage pageKey="intro"><IntroView onEnter={() => setTunnelTarget({ page: "connect" })} /></AnimatedPage> : null}
        {route.page === "connect" ? <AnimatedPage pageKey="connect"><ConnectView privy={privy} onContinue={() => setTunnelTarget({ page: "home" })} onSkip={() => setTunnelTarget({ page: "terminal" })} /></AnimatedPage> : null}
        {route.page === "home" ? <AnimatedPage pageKey="home"><HomeView snapshot={snapshot} activeCard={activeCard} onOpenTerminal={() => navigateTo({ page: "terminal" })} onOpenReplay={() => navigateTo({ page: "replay" })} onOpenWatchlists={() => navigateTo({ page: "watchlists" })} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "terminal" ? (
          <AnimatedPage pageKey="terminal">
            <TerminalView
              mode={mode}
              setMode={setMode}
              activeCard={activeCard}
              activeSymbol={activeSymbol}
              symbols={snapshot.symbols}
              selectedEvent={selectedEvent}
              selectedEventId={selectedEventId}
              tickerEvents={tickerEvents}
              tickerIndex={tickerIndex}
              kpis={kpis}
              timelineRows={timelineRows}
              symbolEvents={symbolEvents}
              rankedEvents={rankedEvents}
              query={query}
              severityFilter={severityFilter}
              sideFilter={sideFilter}
              minScore={minScore}
              autoRefresh={autoRefresh}
              alertInbox={snapshot.alertInbox}
              narratives={snapshot.narratives}
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
              onSelectSymbol={setActiveSymbol}
              onSelectEvent={setSelectedEventId}
              onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })}
            />
          </AnimatedPage>
        ) : null}
        {route.page === "watchlists" ? <AnimatedPage pageKey="watchlists"><WatchlistsView privy={privy} symbols={snapshot.symbols} events={rankedEvents} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "replay" ? <AnimatedPage pageKey="replay"><ReplayView rows={timelineRows} groupedEvents={replaySymbols} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "symbol" ? <AnimatedPage pageKey={`symbol-${route.symbol}`}><SymbolView card={activeCard} events={symbolEvents} allSymbols={snapshot.symbols} onSelectSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} onBack={() => navigateTo({ page: "terminal" })} /></AnimatedPage> : null}
      </main>
    </AppFrame>
  );
}

export default App;
