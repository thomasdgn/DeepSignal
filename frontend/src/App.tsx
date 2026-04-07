import { useEffect, useMemo, useState } from "react";
import { fallbackSnapshot, type Mode, type SymbolKey, type TerminalSnapshot } from "./data/demoData";
import { useDeepSignalPrivy } from "./privy";
import { AppFrame, AnimatedPage, TopNav, TunnelTransition } from "./uiFrame";
import { AdvisorView, ConnectView, HomeView, IntroView, ReplayView, SymbolView, TerminalView, WatchlistsView } from "./uiViews";
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

type SavedWatchlist = {
  id: string;
  name: string;
  description: string;
  symbols: SymbolKey[];
};

type PersonalInboxItem = {
  id: string;
  title: string;
  state: string;
  note: string;
};

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

type StoredWorkspace = {
  mode?: Mode;
  activeSymbol?: SymbolKey;
  activeWatchlistId?: string;
  query?: string;
  severityFilter?: SeverityFilter;
  sideFilter?: SideFilter;
  minScore?: number;
  autoRefresh?: boolean;
  updatedAt?: string;
};

type StoredPersonalSpace = {
  favoriteSymbols?: SymbolKey[];
  pinnedAlertIds?: string[];
  inboxItems?: PersonalInboxItem[];
};

type AdvisorRiskProfile = "prudent" | "balanced" | "aggressive";
type AdvisorTimeHorizon = "intraday" | "swing" | "position";
type AdvisorTradingStyle = "trend" | "narrative" | "scalp";

type StoredAdvisorWorkspace = {
  selectedProfile?: AdvisorRiskProfile;
  walletAmount?: number;
  timeHorizon?: AdvisorTimeHorizon;
  tradingStyle?: AdvisorTradingStyle;
  excludedSymbols?: SymbolKey[];
  updatedAt?: string;
};

type AdvisorHistoryItem = {
  id: string;
  question: string;
  answer: string;
  status: string;
  createdAt: string;
  discordMessage?: string;
};

type AdvisorSignal = {
  symbol: string;
  side: string;
  action: string;
  confidence: string;
  score: number;
  severity: string;
  attention_score: number;
  thesis: string;
  risk: string;
  discord_message: string;
};

type AdvisorBrief = {
  generated_at: string;
  lookback_hours: number;
  advisor_status: string;
  elfa_status: string;
  market_summary: {
    elfa_status: string;
    summary_line: string;
    trending_tokens: string[];
  };
  agent_brief?: {
    status: string;
    mode: string;
    summary: string;
    action_items: string[];
    caution: string;
    prompt_basis?: {
      hot_symbols?: string[];
      ranked_symbols?: string[];
    };
  };
  signals: AdvisorSignal[];
  discord_messages: string[];
};

function buildDefaultWatchlists(symbols: SymbolKey[]): SavedWatchlist[] {
  return [
    {
      id: "default-momentum-room",
      name: "Momentum room",
      description: "Continuation setups with the strongest ranked conviction.",
      symbols: symbols.includes("SOL") ? ["SOL", "BTC"] : symbols.slice(0, 2),
    },
    {
      id: "default-narrative-radar",
      name: "Narrative radar",
      description: "Symbols where narrative heat and whale flow start syncing.",
      symbols: symbols.includes("ETH") ? ["ETH", "SOL"] : symbols.slice(0, 2),
    },
  ];
}

function buildDefaultPersonalInbox(snapshot: TerminalSnapshot): PersonalInboxItem[] {
  return snapshot.alertInbox.map((item, index) => ({
    id: `inbox-${index}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: item.title,
    state: item.state,
    note: item.note,
  }));
}

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
  const [savedWatchlists, setSavedWatchlists] = useState<SavedWatchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>("all");
  const [lastScopeUpdatedAt, setLastScopeUpdatedAt] = useState<string>(new Date().toISOString());
  const [favoriteSymbols, setFavoriteSymbols] = useState<SymbolKey[]>([]);
  const [pinnedAlertIds, setPinnedAlertIds] = useState<string[]>([]);
  const [personalInbox, setPersonalInbox] = useState<PersonalInboxItem[]>([]);
  const [advisorBrief, setAdvisorBrief] = useState<AdvisorBrief | null>(null);
  const [advisorProfile, setAdvisorProfile] = useState<AdvisorRiskProfile>("balanced");
  const [advisorWalletAmount, setAdvisorWalletAmount] = useState(5000);
  const [advisorTimeHorizon, setAdvisorTimeHorizon] = useState<AdvisorTimeHorizon>("swing");
  const [advisorTradingStyle, setAdvisorTradingStyle] = useState<AdvisorTradingStyle>("trend");
  const [advisorExcludedSymbols, setAdvisorExcludedSymbols] = useState<SymbolKey[]>([]);
  const [advisorHistory, setAdvisorHistory] = useState<AdvisorHistoryItem[]>([]);

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

    async function loadAdvisorBrief() {
      try {
        const response = await fetch("/advisor-brief.json", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as AdvisorBrief;
        if (!cancelled && payload) {
          setAdvisorBrief(payload);
        }
      } catch {
        // Keep advisor page in fallback mode if export is not present yet.
      }
    }

    void loadSnapshot();
    void loadAdvisorBrief();

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
  const activeWatchlist = useMemo(
    () => savedWatchlists.find((watchlist) => watchlist.id === activeWatchlistId) ?? null,
    [activeWatchlistId, savedWatchlists],
  );
  const scopedModeEvents = useMemo(() => {
    if (!activeWatchlist) {
      return modeEvents;
    }
    return modeEvents.filter((event) => activeWatchlist.symbols.includes(event.symbol));
  }, [activeWatchlist, modeEvents]);
  const visibleEvents = useMemo(
    () =>
      scopedModeEvents.filter((event) => {
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
    [minScore, query, scopedModeEvents, severityFilter, sideFilter],
  );
  const tickerEvents = visibleEvents.length > 0 ? visibleEvents : scopedModeEvents;
  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? scopedModeEvents[0] ?? modeEvents[0],
    [modeEvents, scopedModeEvents, selectedEventId, visibleEvents],
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
  const timelineRows = useMemo(() => buildTimelineRows(visibleEvents.length > 0 ? visibleEvents : scopedModeEvents), [scopedModeEvents, visibleEvents]);
  const replaySymbols = useMemo(
    () =>
      snapshot.symbols.map((symbol) => ({
        symbol,
        events: visibleEvents.filter((event) => event.symbol === symbol.symbol),
      })),
    [snapshot.symbols, visibleEvents],
  );
  const terminalSymbols = useMemo(() => {
    if (!activeWatchlist) {
      return snapshot.symbols;
    }
    return snapshot.symbols.filter((symbol) => activeWatchlist.symbols.includes(symbol.symbol));
  }, [activeWatchlist, snapshot.symbols]);
  const watchlistIdentity = useMemo(() => {
    const email = privy.user?.email?.address;
    if (email) {
      return email.toLowerCase();
    }
    const wallet = privy.user?.wallet?.address;
    if (wallet) {
      return wallet.toLowerCase();
    }
    return "guest";
  }, [privy.user]);
  const availableSymbols = useMemo(() => snapshot.symbols.map((symbol) => symbol.symbol), [snapshot.symbols]);
  const inferredFavoriteSymbols = useMemo(() => {
    const frequency = new Map<SymbolKey, number>();
    for (const watchlist of savedWatchlists) {
      for (const symbol of watchlist.symbols) {
        frequency.set(symbol, (frequency.get(symbol) ?? 0) + 1);
      }
    }
    return [...frequency.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([symbol]) => symbol);
  }, [savedWatchlists]);
  const effectiveFavoriteSymbols = favoriteSymbols.length > 0 ? favoriteSymbols : inferredFavoriteSymbols;
  const pinnedEvents = useMemo(
    () => rankedEvents.filter((event) => pinnedAlertIds.includes(event.id)),
    [pinnedAlertIds, rankedEvents],
  );
  const profileSummary = useMemo<ProfileSummary>(() => {
    const email = privy.user?.email?.address;
    const wallet = privy.user?.wallet?.address;
    return {
      label: email ?? (wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Guest operator"),
      isAuthenticated: privy.authenticated,
      watchlistCount: savedWatchlists.length,
      favoriteSymbols: effectiveFavoriteSymbols,
      lastScopeName: activeWatchlist?.name ?? "All signals",
      lastScopeUpdatedAt,
      pinnedCount: pinnedAlertIds.length,
      inboxCount: personalInbox.length,
    };
  }, [activeWatchlist, effectiveFavoriteSymbols, lastScopeUpdatedAt, personalInbox.length, pinnedAlertIds.length, privy.authenticated, privy.user, savedWatchlists.length]);

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

  useEffect(() => {
    const storageKey = `deepsignal-watchlists:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setSavedWatchlists(buildDefaultWatchlists(availableSymbols));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SavedWatchlist[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSavedWatchlists(parsed);
        return;
      }
    } catch {
      // Ignore invalid local payloads and restore defaults.
    }

    setSavedWatchlists(buildDefaultWatchlists(availableSymbols));
  }, [availableSymbols, watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-watchlists:${watchlistIdentity}`;
    window.localStorage.setItem(storageKey, JSON.stringify(savedWatchlists));
  }, [savedWatchlists, watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-last-scope:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { activeWatchlistId?: string; updatedAt?: string };
      if (parsed.activeWatchlistId) {
        setActiveWatchlistId(parsed.activeWatchlistId);
      }
      if (parsed.updatedAt) {
        setLastScopeUpdatedAt(parsed.updatedAt);
      }
    } catch {
      // Ignore invalid local payloads.
    }
  }, [watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-last-scope:${watchlistIdentity}`;
    const payload = {
      activeWatchlistId,
      updatedAt: lastScopeUpdatedAt,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [activeWatchlistId, lastScopeUpdatedAt, watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-workspace:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredWorkspace;
      if (parsed.mode === "Live" || parsed.mode === "Replay" || parsed.mode === "Demo") {
        setMode(parsed.mode);
      }
      if (parsed.activeSymbol === "BTC" || parsed.activeSymbol === "ETH" || parsed.activeSymbol === "SOL") {
        setActiveSymbol(parsed.activeSymbol);
      }
      if (typeof parsed.query === "string") {
        setQuery(parsed.query);
      }
      if (parsed.severityFilter === "all" || parsed.severityFilter === "critical" || parsed.severityFilter === "high" || parsed.severityFilter === "medium") {
        setSeverityFilter(parsed.severityFilter);
      }
      if (parsed.sideFilter === "all" || parsed.sideFilter === "open_long" || parsed.sideFilter === "open_short" || parsed.sideFilter === "close_long" || parsed.sideFilter === "close_short") {
        setSideFilter(parsed.sideFilter);
      }
      if (typeof parsed.minScore === "number") {
        setMinScore(parsed.minScore);
      }
      if (typeof parsed.autoRefresh === "boolean") {
        setAutoRefresh(parsed.autoRefresh);
      }
      if (parsed.activeWatchlistId) {
        setActiveWatchlistId(parsed.activeWatchlistId);
      }
      if (parsed.updatedAt) {
        setLastScopeUpdatedAt(parsed.updatedAt);
      }
    } catch {
      // Ignore invalid workspace payloads.
    }
  }, [watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-workspace:${watchlistIdentity}`;
    const payload: StoredWorkspace = {
      mode,
      activeSymbol,
      activeWatchlistId,
      query,
      severityFilter,
      sideFilter,
      minScore,
      autoRefresh,
      updatedAt: lastScopeUpdatedAt,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    activeSymbol,
    activeWatchlistId,
    autoRefresh,
    lastScopeUpdatedAt,
    minScore,
    mode,
    query,
    severityFilter,
    sideFilter,
    watchlistIdentity,
  ]);

  useEffect(() => {
    const storageKey = `deepsignal-personal:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setFavoriteSymbols([]);
      setPinnedAlertIds(snapshot.eventFeed.slice(0, 2).map((event) => event.id));
      setPersonalInbox(buildDefaultPersonalInbox(snapshot));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredPersonalSpace;
      const nextFavoriteSymbols = Array.isArray(parsed.favoriteSymbols)
        ? parsed.favoriteSymbols.filter((symbol): symbol is SymbolKey => symbol === "BTC" || symbol === "ETH" || symbol === "SOL")
        : [];
      const nextPinnedAlertIds = Array.isArray(parsed.pinnedAlertIds)
        ? parsed.pinnedAlertIds.filter((id): id is string => typeof id === "string")
        : snapshot.eventFeed.slice(0, 2).map((event) => event.id);
      const nextInbox = Array.isArray(parsed.inboxItems)
        ? parsed.inboxItems.filter(
            (item): item is PersonalInboxItem =>
              typeof item?.id === "string" &&
              typeof item?.title === "string" &&
              typeof item?.state === "string" &&
              typeof item?.note === "string",
          )
        : buildDefaultPersonalInbox(snapshot);
      setFavoriteSymbols(nextFavoriteSymbols);
      setPinnedAlertIds(nextPinnedAlertIds);
      setPersonalInbox(nextInbox);
    } catch {
      setFavoriteSymbols([]);
      setPinnedAlertIds(snapshot.eventFeed.slice(0, 2).map((event) => event.id));
      setPersonalInbox(buildDefaultPersonalInbox(snapshot));
    }
  }, [snapshot, watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-personal:${watchlistIdentity}`;
    const payload: StoredPersonalSpace = {
      favoriteSymbols,
      pinnedAlertIds,
      inboxItems: personalInbox,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [favoriteSymbols, personalInbox, pinnedAlertIds, watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-advisor:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setAdvisorProfile("balanced");
      setAdvisorWalletAmount(5000);
      setAdvisorTimeHorizon("swing");
      setAdvisorTradingStyle("trend");
      setAdvisorExcludedSymbols([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredAdvisorWorkspace;
      if (parsed.selectedProfile === "prudent" || parsed.selectedProfile === "balanced" || parsed.selectedProfile === "aggressive") {
        setAdvisorProfile(parsed.selectedProfile);
      }
      if (typeof parsed.walletAmount === "number" && Number.isFinite(parsed.walletAmount) && parsed.walletAmount > 0) {
        setAdvisorWalletAmount(parsed.walletAmount);
      }
      if (parsed.timeHorizon === "intraday" || parsed.timeHorizon === "swing" || parsed.timeHorizon === "position") {
        setAdvisorTimeHorizon(parsed.timeHorizon);
      }
      if (parsed.tradingStyle === "trend" || parsed.tradingStyle === "narrative" || parsed.tradingStyle === "scalp") {
        setAdvisorTradingStyle(parsed.tradingStyle);
      }
      if (Array.isArray(parsed.excludedSymbols)) {
        setAdvisorExcludedSymbols(
          parsed.excludedSymbols.filter((symbol): symbol is SymbolKey => symbol === "BTC" || symbol === "ETH" || symbol === "SOL"),
        );
      }
    } catch {
      setAdvisorProfile("balanced");
      setAdvisorWalletAmount(5000);
      setAdvisorTimeHorizon("swing");
      setAdvisorTradingStyle("trend");
      setAdvisorExcludedSymbols([]);
    }
  }, [watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-advisor:${watchlistIdentity}`;
    const payload: StoredAdvisorWorkspace = {
      selectedProfile: advisorProfile,
      walletAmount: advisorWalletAmount,
      timeHorizon: advisorTimeHorizon,
      tradingStyle: advisorTradingStyle,
      excludedSymbols: advisorExcludedSymbols,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    advisorExcludedSymbols,
    advisorHistory,
    advisorProfile,
    advisorTimeHorizon,
    advisorTradingStyle,
    advisorWalletAmount,
    watchlistIdentity,
  ]);

  useEffect(() => {
    const storageKey = `deepsignal-advisor-history:${watchlistIdentity}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setAdvisorHistory([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AdvisorHistoryItem[];
      if (!Array.isArray(parsed)) {
        setAdvisorHistory([]);
        return;
      }
      setAdvisorHistory(
        parsed.filter(
          (item): item is AdvisorHistoryItem =>
            typeof item?.id === "string" &&
            typeof item?.question === "string" &&
            typeof item?.answer === "string" &&
            typeof item?.status === "string" &&
            typeof item?.createdAt === "string",
        ),
      );
    } catch {
      setAdvisorHistory([]);
    }
  }, [watchlistIdentity]);

  useEffect(() => {
    const storageKey = `deepsignal-advisor-history:${watchlistIdentity}`;
    window.localStorage.setItem(storageKey, JSON.stringify(advisorHistory));
  }, [advisorHistory, watchlistIdentity]);

  function appendAdvisorHistoryItem(item: Omit<AdvisorHistoryItem, "id" | "createdAt">) {
    setAdvisorHistory((current) => [
      {
        id: `advisor-history-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...item,
      },
      ...current.filter((entry) => entry.question !== item.question).slice(0, 7),
    ]);
  }

  useEffect(() => {
    if (activeWatchlistId !== "all" && !savedWatchlists.some((watchlist) => watchlist.id === activeWatchlistId)) {
      setActiveWatchlistId("all");
    }
  }, [activeWatchlistId, savedWatchlists]);

  useEffect(() => {
    if (!activeWatchlist) {
      return;
    }
    if (!activeWatchlist.symbols.includes(activeSymbol) && activeWatchlist.symbols[0]) {
      setActiveSymbol(activeWatchlist.symbols[0]);
    }
  }, [activeSymbol, activeWatchlist]);

  useEffect(() => {
    setPinnedAlertIds((current) => current.filter((id) => snapshot.eventFeed.some((event) => event.id === id)));
  }, [snapshot.eventFeed]);

  useEffect(() => {
    setFavoriteSymbols((current) => current.filter((symbol) => availableSymbols.includes(symbol)));
  }, [availableSymbols]);

  function toggleFavoriteSymbol(symbol: SymbolKey) {
    setFavoriteSymbols((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  function togglePinnedAlert(eventId: string) {
    setPinnedAlertIds((current) =>
      current.includes(eventId) ? current.filter((item) => item !== eventId) : [eventId, ...current].slice(0, 6),
    );
  }

  function cycleInboxState(inboxId: string) {
    const states = ["unacknowledged", "watching", "acknowledged", "resolved"];
    setPersonalInbox((current) =>
      current.map((item) => {
        if (item.id !== inboxId) {
          return item;
        }
        const currentIndex = states.indexOf(item.state);
        return {
          ...item,
          state: states[(currentIndex + 1) % states.length] ?? states[0],
        };
      }),
    );
  }

  function addInboxFromEvent(eventId: string) {
    const source = rankedEvents.find((event) => event.id === eventId);
    if (!source) {
      return;
    }
    const inboxId = `event-${source.id}`;
    setPersonalInbox((current) => {
      if (current.some((item) => item.id === inboxId)) {
        return current;
      }
      return [
        {
          id: inboxId,
          title: `${source.symbol} ${source.signal}`,
          state: "watching",
          note: source.narrative,
        },
        ...current,
      ].slice(0, 8);
    });
  }

  function navigateTo(nextRoute: Route) {
    window.history.pushState({}, "", routeToPath(nextRoute));
    setRouteState(nextRoute);
  }

  function createWatchlist(name: string, description: string, symbols: SymbolKey[]) {
    setSavedWatchlists((current) => [
      {
        id: `wl-${Date.now()}`,
        name,
        description,
        symbols: [...new Set(symbols)],
      },
      ...current,
    ]);
  }

  function toggleWatchlistSymbol(watchlistId: string, symbol: SymbolKey) {
    setSavedWatchlists((current) =>
      current.map((watchlist) => {
        if (watchlist.id !== watchlistId) {
          return watchlist;
        }
        const exists = watchlist.symbols.includes(symbol);
        const nextSymbols = exists
          ? watchlist.symbols.filter((item) => item !== symbol)
          : [...watchlist.symbols, symbol];
        return {
          ...watchlist,
          symbols: nextSymbols,
        };
      }),
    );
  }

  function removeWatchlist(watchlistId: string) {
    setSavedWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
  }

  function focusWatchlist(watchlistId: string) {
    setActiveWatchlistId(watchlistId);
    setLastScopeUpdatedAt(new Date().toISOString());
    navigateTo({ page: "terminal" });
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
            profileSummary={profileSummary}
            onToggleTheme={() => setThemeMode((current) => (current === "night" ? "day" : "night"))}
            onToggleAccent={() => setAccentTheme((current) => (current === "blue" ? "red" : "blue"))}
          />
        ) : null}

        {route.page === "intro" ? <AnimatedPage pageKey="intro"><IntroView onEnter={() => setTunnelTarget({ page: "connect" })} /></AnimatedPage> : null}
        {route.page === "connect" ? <AnimatedPage pageKey="connect"><ConnectView privy={privy} profileSummary={profileSummary} onContinue={() => setTunnelTarget({ page: "home" })} onSkip={() => setTunnelTarget({ page: "terminal" })} /></AnimatedPage> : null}
        {route.page === "home" ? <AnimatedPage pageKey="home"><HomeView snapshot={snapshot} activeCard={activeCard} onOpenTerminal={() => navigateTo({ page: "terminal" })} onOpenReplay={() => navigateTo({ page: "replay" })} onOpenWatchlists={() => navigateTo({ page: "watchlists" })} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "advisor" ? <AnimatedPage pageKey="advisor"><AdvisorView brief={advisorBrief} topEvents={rankedEvents} topSymbols={snapshot.symbols} selectedProfile={advisorProfile} walletAmount={advisorWalletAmount} timeHorizon={advisorTimeHorizon} tradingStyle={advisorTradingStyle} excludedSymbols={advisorExcludedSymbols} history={advisorHistory} onSelectedProfileChange={setAdvisorProfile} onWalletAmountChange={setAdvisorWalletAmount} onTimeHorizonChange={setAdvisorTimeHorizon} onTradingStyleChange={setAdvisorTradingStyle} onExcludedSymbolsChange={setAdvisorExcludedSymbols} onHistoryAdd={appendAdvisorHistoryItem} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} onOpenTerminal={() => navigateTo({ page: "terminal" })} /></AnimatedPage> : null}
        {route.page === "terminal" ? (
          <AnimatedPage pageKey="terminal">
            <TerminalView
              mode={mode}
              setMode={setMode}
              activeCard={activeCard}
              activeSymbol={activeSymbol}
              symbols={terminalSymbols}
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
              activeWatchlistId={activeWatchlistId}
              activeWatchlistName={activeWatchlist?.name ?? "All signals"}
              watchlists={savedWatchlists}
              alertInbox={snapshot.alertInbox}
              pinnedEvents={pinnedEvents}
              narratives={snapshot.narratives}
              favoriteSymbols={effectiveFavoriteSymbols}
              onQueryChange={setQuery}
              onSeverityChange={setSeverityFilter}
              onSideChange={setSideFilter}
              onMinScoreChange={setMinScore}
              onAutoRefreshChange={setAutoRefresh}
              onActiveWatchlistChange={(value) => {
                setActiveWatchlistId(value);
                setLastScopeUpdatedAt(new Date().toISOString());
              }}
              onReset={() => {
                setQuery("");
                setSeverityFilter("all");
                setSideFilter("all");
                setMinScore(70);
              }}
              onSelectSymbol={setActiveSymbol}
              onSelectEvent={setSelectedEventId}
              onTogglePinnedAlert={togglePinnedAlert}
              onAddInboxFromEvent={addInboxFromEvent}
              onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })}
            />
          </AnimatedPage>
        ) : null}
        {route.page === "watchlists" ? <AnimatedPage pageKey="watchlists"><WatchlistsView privy={privy} profileSummary={profileSummary} symbols={snapshot.symbols} events={rankedEvents} savedWatchlists={savedWatchlists} activeWatchlistId={activeWatchlistId} favoriteSymbols={effectiveFavoriteSymbols} pinnedEvents={pinnedEvents} personalInbox={personalInbox} onCreateWatchlist={createWatchlist} onToggleWatchlistSymbol={toggleWatchlistSymbol} onRemoveWatchlist={removeWatchlist} onActivateWatchlist={focusWatchlist} onToggleFavoriteSymbol={toggleFavoriteSymbol} onTogglePinnedAlert={togglePinnedAlert} onCycleInboxState={cycleInboxState} onAddInboxFromEvent={addInboxFromEvent} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "replay" ? <AnimatedPage pageKey="replay"><ReplayView rows={timelineRows} groupedEvents={replaySymbols} onOpenSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} /></AnimatedPage> : null}
        {route.page === "symbol" ? <AnimatedPage pageKey={`symbol-${route.symbol}`}><SymbolView card={activeCard} events={symbolEvents} allSymbols={snapshot.symbols} onSelectSymbol={(symbol) => navigateTo({ page: "symbol", symbol })} onBack={() => navigateTo({ page: "terminal" })} /></AnimatedPage> : null}
      </main>
    </AppFrame>
  );
}

export default App;
