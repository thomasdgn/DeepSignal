import { type EventRecord, type Mode, type SymbolCard, type SymbolKey } from "./data/demoData";

export type ThemeMode = "night" | "day";
export type AccentTheme = "blue" | "red";
export type SeverityFilter = EventRecord["severity"] | "all";
export type SideFilter = EventRecord["side"] | "all";

export type Route =
  | { page: "intro" }
  | { page: "connect" }
  | { page: "home" }
  | { page: "terminal" }
  | { page: "watchlists" }
  | { page: "replay" }
  | { page: "symbol"; symbol: SymbolKey };

const signalAttention: Record<EventRecord["signal"], number> = {
  "high-attention": 95,
  "rising-attention": 74,
  "low-attention": 44,
};

export const sideLabels: Record<EventRecord["side"], string> = {
  open_long: "Open long",
  open_short: "Open short",
  close_long: "Close long",
  close_short: "Close short",
};

export function parseRoute(pathname: string): Route {
  if (pathname === "/") {
    return { page: "intro" };
  }
  if (pathname === "/connect") {
    return { page: "connect" };
  }
  if (pathname === "/home") {
    return { page: "home" };
  }
  if (pathname === "/terminal") {
    return { page: "terminal" };
  }
  if (pathname === "/watchlists") {
    return { page: "watchlists" };
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
  return { page: "intro" };
}

export function routeToPath(route: Route): string {
  switch (route.page) {
    case "intro":
      return "/";
    case "connect":
      return "/connect";
    case "home":
      return "/home";
    case "terminal":
      return "/terminal";
    case "watchlists":
      return "/watchlists";
    case "replay":
      return "/replay";
    case "symbol":
      return `/symbol/${route.symbol.toLowerCase()}`;
  }
}

export function isActiveRoute(route: Route, page: Route["page"]) {
  return route.page === page ? "nav-link active" : "nav-link";
}

export function getModeEvents(mode: Mode, events: EventRecord[]) {
  if (mode === "Replay") {
    return [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }
  if (mode === "Live") {
    return [...events].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }
  return events;
}

export function buildFlowRow(symbol: SymbolKey, events: EventRecord[]) {
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

export function buildActiveCard(symbol: SymbolKey, events: EventRecord[], baseSymbols: SymbolCard[]) {
  const fallback = baseSymbols[0];
  const baseCard = baseSymbols.find((item) => item.symbol === symbol) ?? fallback;
  const symbolEvents = events.filter((event) => event.symbol === symbol);
  if (symbolEvents.length === 0) {
    return baseCard;
  }

  const averageScore = symbolEvents.reduce((total, event) => total + event.score, 0) / symbolEvents.length;
  const averageAttention =
    symbolEvents.reduce((total, event) => total + signalAttention[event.signal], 0) / symbolEvents.length;
  const flow = buildFlowRow(symbol, symbolEvents);
  const direction: SymbolCard["direction"] =
    Math.abs(flow.net) < 50_000 ? "mixed" : flow.net > 0 ? "bullish" : "bearish";

  return {
    ...baseCard,
    hotScore: Number(averageScore.toFixed(1)),
    attention: Math.round(averageAttention),
    confidence: Math.round((averageScore * 0.6) + (averageAttention * 0.4)),
    direction,
    dominantFlow: `${flow.net >= 0 ? "+" : "-"}$${Math.abs(flow.net / 1000).toFixed(0)}k net ${direction}`,
    highlights: [
      `${symbolEvents.length} live signal${symbolEvents.length > 1 ? "s" : ""} in view`,
      `${sideLabels[symbolEvents[0].side]} is leading this symbol now`,
      `${symbolEvents[0].signal.replace("-", " ")} is shaping the narrative layer`,
    ],
  };
}

export function buildKpis(events: EventRecord[], note: string) {
  if (events.length === 0) {
    return [
      { label: "Signals", value: "0", note },
      { label: "Tracked Notional", value: "$0", note: "no qualifying flow" },
      { label: "Highest Score", value: "0", note: "filters too narrow" },
      { label: "Narrative Heat", value: "0", note: "no attention signal" },
    ];
  }

  const totalNotional = events.reduce((total, event) => total + event.notionalUsd, 0);
  const highestScore = Math.max(...events.map((event) => event.score));
  const highestAttention = Math.max(...events.map((event) => signalAttention[event.signal]));

  return [
    { label: "Signals", value: String(events.length), note },
    { label: "Tracked Notional", value: `$${(totalNotional / 1_000_000).toFixed(1)}M`, note: "filtered flow" },
    { label: "Highest Score", value: highestScore.toFixed(1), note: "priority signal" },
    { label: "Narrative Heat", value: String(highestAttention), note: "social pulse proxy" },
  ];
}

export function buildTimelineRows(events: EventRecord[]) {
  const buckets = new Map<string, { notional: number; events: number }>();

  for (const event of events) {
    const hour = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const current = buckets.get(hour) ?? { notional: 0, events: 0 };
    current.notional += event.notionalUsd;
    current.events += 1;
    buckets.set(hour, current);
  }

  return [...buckets.entries()].map(([hour, current]) => ({
    hour,
    notional: current.notional,
    events: current.events,
  }));
}

export function activeSymbolUniverse(events: EventRecord[], baseSymbols: SymbolCard[]) {
  const universe = new Set<SymbolKey>(baseSymbols.map((symbol) => symbol.symbol));
  for (const event of events) {
    universe.add(event.symbol);
  }
  return [...universe];
}
