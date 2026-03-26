import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode } from "react";
import { type AccentTheme, isActiveRoute, type Route, type ThemeMode } from "./uiHelpers";

export function AppFrame({
  children,
  themeMode,
  accentTheme,
}: {
  children: ReactNode;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
}) {
  return (
    <div className="app-shell" data-theme={themeMode} data-accent={accentTheme}>
      <Backdrop />
      {children}
    </div>
  );
}

export function TopNav({
  route,
  onNavigate,
  themeMode,
  accentTheme,
  onToggleTheme,
  onToggleAccent,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  onToggleTheme: () => void;
  onToggleAccent: () => void;
}) {
  return (
    <header className="topbar">
      <button type="button" className="brand-pill" onClick={() => onNavigate({ page: "home" })}>
        DeepSignal
      </button>
      <nav className="topbar-nav">
        <button type="button" className={isActiveRoute(route, "home")} onClick={() => onNavigate({ page: "home" })}>
          Home
        </button>
        <button type="button" className={isActiveRoute(route, "connect")} onClick={() => onNavigate({ page: "connect" })}>
          Connect
        </button>
        <button type="button" className={isActiveRoute(route, "terminal")} onClick={() => onNavigate({ page: "terminal" })}>
          Terminal
        </button>
        <button type="button" className={isActiveRoute(route, "watchlists")} onClick={() => onNavigate({ page: "watchlists" })}>
          Watchlists
        </button>
        <button type="button" className={isActiveRoute(route, "replay")} onClick={() => onNavigate({ page: "replay" })}>
          Replay
        </button>
      </nav>
      <div className="topbar-actions">
        <button type="button" className="chip-button" onClick={onToggleAccent}>
          {accentTheme === "blue" ? "Blue" : "Red"}
        </button>
        <button type="button" className="chip-button" onClick={onToggleTheme}>
          {themeMode === "night" ? "Night" : "Day"}
        </button>
      </div>
    </header>
  );
}

export function AnimatedPage({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={pageKey}
        className="page-motion"
        initial={{ opacity: 0, y: 22, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -18, scale: 0.99 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        {children}
      </motion.section>
    </AnimatePresence>
  );
}

export function TunnelTransition({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="tunnel-transition"
          initial={{ clipPath: "circle(0% at 50% 54%)", opacity: 0.18 }}
          animate={{ clipPath: "circle(160% at 50% 54%)", opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="tunnel-radar" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Backdrop() {
  return (
    <div className="backdrop-layer" aria-hidden="true">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="glow glow-c" />
      <div className="mesh-grid" />
    </div>
  );
}
