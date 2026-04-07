from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import json
from typing import Any

from deepsignal.sponsors.elfa_client import ElfaApiClient
from deepsignal.storage import DeepSignalStorage

RISK_PROFILES: dict[str, dict[str, str | float]] = {
    "prudent": {
        "label": "Prudent",
        "entry_bias": "confirmation first",
        "size_hint": "1 to 3% starter size",
        "watch_bias": "prefer observe-only or delayed entries",
        "discord_tone": "capital preservation first",
        "score_floor": 82.0,
    },
    "balanced": {
        "label": "Balanced",
        "entry_bias": "scale in on confirmation",
        "size_hint": "3 to 6% tactical size",
        "watch_bias": "watch for entry on clean continuation",
        "discord_tone": "risk-adjusted participation",
        "score_floor": 72.0,
    },
    "aggressive": {
        "label": "Aggressive",
        "entry_bias": "lean into momentum early",
        "size_hint": "5 to 10% high-conviction size",
        "watch_bias": "act earlier when social confirmation is live",
        "discord_tone": "high beta, fast reaction",
        "score_floor": 65.0,
    },
}


@dataclass(frozen=True)
class AdvisorSignal:
    profile: str
    symbol: str
    side: str
    action: str
    confidence: str
    score: float
    severity: str
    attention_score: float
    allocation_hint: str
    entry_style: str
    thesis: str
    risk: str
    discord_message: str


class DeepSignalAdvisor:
    def __init__(
        self,
        storage: DeepSignalStorage,
        *,
        elfa_api_key: str | None,
        elfa_base_url: str,
    ) -> None:
        self.storage = storage
        self.elfa_api_key = elfa_api_key
        self.elfa_base_url = elfa_base_url

    def build_brief(self, lookback_hours: int = 24) -> dict[str, Any]:
        dashboard = self.storage.get_dashboard_data(lookback_hours=lookback_hours)
        ranked_alerts = dashboard.get("ranked_alerts", [])
        hot_symbols = dashboard.get("hot_symbols", [])
        narrative_summary = {
            item["symbol"]: item
            for item in dashboard.get("narrative_summary", [])
            if isinstance(item, dict) and "symbol" in item
        }

        market_context = self._build_market_context(hot_symbols)
        profiles = {
            profile: self._build_profile_plan(profile, ranked_alerts[:3], narrative_summary, market_context)
            for profile in RISK_PROFILES
        }
        default_profile = "balanced"
        default_signals = profiles[default_profile]["signals"]
        default_discord_messages = profiles[default_profile]["discord_messages"]
        agent_brief = self._build_agent_brief(
            market_context=market_context,
            ranked_alerts=ranked_alerts[:3],
            hot_symbols=hot_symbols[:3],
        )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "lookback_hours": lookback_hours,
            "advisor_status": "ready" if default_signals else "empty",
            "elfa_status": market_context["elfa_status"],
            "market_summary": market_context,
            "agent_brief": agent_brief,
            "default_profile": default_profile,
            "signals": default_signals,
            "discord_messages": default_discord_messages,
            "profiles": profiles,
        }

    def export_brief(self, output_path: Path, lookback_hours: int = 24) -> Path:
        brief = self.build_brief(lookback_hours=lookback_hours)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(brief, indent=2), encoding="utf-8")
        return output_path

    def ask_agent(self, question: str, lookback_hours: int = 24) -> dict[str, Any]:
        dashboard = self.storage.get_dashboard_data(lookback_hours=lookback_hours)
        ranked_alerts = dashboard.get("ranked_alerts", [])
        hot_symbols = dashboard.get("hot_symbols", [])
        market_context = self._build_market_context(hot_symbols)
        fallback = self._build_local_question_response(question, market_context, ranked_alerts[:3], hot_symbols[:3])

        if not self.elfa_api_key:
            fallback["status"] = "disabled"
            return fallback

        client = ElfaApiClient(self.elfa_api_key, self.elfa_base_url)
        prompt = self._build_question_prompt(question, market_context, ranked_alerts[:3], hot_symbols[:3])
        try:
            payload = client.chat(message=prompt, mode="chat")
        except RuntimeError as exc:
            fallback["status"] = "error"
            fallback["answer"] = f"{fallback['answer']} ELFA chat fallback active because chat failed: {exc}"
            return fallback

        answer = _extract_chat_text(payload)
        if not answer:
            fallback["status"] = "fallback"
            return fallback

        return {
            "status": "live",
            "mode": "chat",
            "question": question,
            "answer": answer,
            "discord_ready_message": self._build_discord_chat_message(question, answer),
            "market_summary": market_context.get("summary_line", ""),
        }

    def _build_signal(
        self,
        profile: str,
        alert: dict[str, Any],
        narrative_context: dict[str, Any] | None,
    ) -> AdvisorSignal:
        profile_config = RISK_PROFILES[profile]
        symbol = str(alert.get("symbol", "UNKNOWN"))
        side = str(alert.get("side", "unknown"))
        score = float(alert.get("score", 0))
        severity = str(alert.get("severity", "medium"))
        enrichment = alert.get("enrichment", {}) if isinstance(alert.get("enrichment"), dict) else {}
        attention_score = float(enrichment.get("elfa_attention_score", 0) or 0)

        action = self._recommend_action(profile, side, score, attention_score)
        confidence = self._build_confidence(score, attention_score)
        allocation_hint = str(profile_config["size_hint"])
        entry_style = self._build_entry_style(profile, score, attention_score)
        thesis = self._build_thesis(symbol, side, enrichment, narrative_context)
        risk = self._build_risk(profile, side, severity, narrative_context)
        discord_message = (
            f"DeepSignal Advisor | {profile.upper()} | {symbol} | {action.upper()} | "
            f"score={score:.1f} | attention={attention_score:.0f} | "
            f"{thesis} | Entry: {entry_style} | Size: {allocation_hint} | Risk: {risk}"
        )

        return AdvisorSignal(
            profile=profile,
            symbol=symbol,
            side=side,
            action=action,
            confidence=confidence,
            score=score,
            severity=severity,
            attention_score=attention_score,
            allocation_hint=allocation_hint,
            entry_style=entry_style,
            thesis=thesis,
            risk=risk,
            discord_message=discord_message,
        )

    def _build_profile_plan(
        self,
        profile: str,
        alerts: list[dict[str, Any]],
        narrative_summary: dict[str, dict[str, Any]],
        market_context: dict[str, Any],
    ) -> dict[str, Any]:
        profile_config = RISK_PROFILES[profile]
        signals = [
            self._build_signal(profile, alert, narrative_summary.get(alert["symbol"]))
            for alert in alerts
        ]
        discord_messages = [signal.discord_message for signal in signals]
        if market_context["summary_line"]:
            discord_messages.insert(
                0,
                (
                    f"{market_context['summary_line']} | "
                    f"profile={profile.upper()} | mode={profile_config['discord_tone']}"
                ),
            )
        return {
            "label": profile_config["label"],
            "entry_bias": profile_config["entry_bias"],
            "size_hint": profile_config["size_hint"],
            "watch_bias": profile_config["watch_bias"],
            "discord_tone": profile_config["discord_tone"],
            "signals": [signal.__dict__ for signal in signals],
            "discord_messages": discord_messages,
        }

    def _build_market_context(self, hot_symbols: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.elfa_api_key:
            return {
                "elfa_status": "disabled",
                "summary_line": "DeepSignal Advisor | ELFA disabled | add ELFA_API_KEY to unlock social context.",
                "trending_tokens": [],
            }

        client = ElfaApiClient(self.elfa_api_key, self.elfa_base_url)
        try:
            trending_tokens = client.get_trending_tokens(time_window="24h", page_size=5, min_mentions=3)
        except RuntimeError as exc:
            return {
                "elfa_status": "error",
                "summary_line": f"DeepSignal Advisor | ELFA error | {exc}",
                "trending_tokens": [],
            }

        names = _extract_token_labels(trending_tokens)[:3]
        hot = [item.get("symbol", "n/a") for item in hot_symbols[:3] if isinstance(item, dict)]
        summary = (
            "DeepSignal Advisor | Hot on Pacifica: "
            f"{', '.join(hot) if hot else 'none'} | "
            f"ELFA trend map: {', '.join(names) if names else 'limited context'}"
        )
        return {
            "elfa_status": "live",
            "summary_line": summary,
            "trending_tokens": names,
        }

    def _build_agent_brief(
        self,
        *,
        market_context: dict[str, Any],
        ranked_alerts: list[dict[str, Any]],
        hot_symbols: list[dict[str, Any]],
    ) -> dict[str, Any]:
        fallback = self._build_local_agent_brief(market_context, ranked_alerts, hot_symbols)
        if not self.elfa_api_key:
            fallback["status"] = "disabled"
            return fallback

        client = ElfaApiClient(self.elfa_api_key, self.elfa_base_url)
        prompt = self._build_agent_prompt(market_context, ranked_alerts, hot_symbols)
        try:
            payload = client.chat(message=prompt, mode="summary")
        except RuntimeError as exc:
            fallback["status"] = "error"
            fallback["summary"] = f"{fallback['summary']} ELFA agent fallback active because chat failed: {exc}"
            return fallback

        summary = _extract_chat_text(payload)
        if not summary:
            fallback["status"] = "fallback"
            return fallback

        return {
            "status": "live",
            "mode": "summary",
            "summary": summary,
            "action_items": fallback["action_items"],
            "caution": fallback["caution"],
            "prompt_basis": {
                "hot_symbols": [item.get("symbol", "n/a") for item in hot_symbols if isinstance(item, dict)],
                "ranked_symbols": [item.get("symbol", "n/a") for item in ranked_alerts if isinstance(item, dict)],
            },
        }

    def _build_agent_prompt(
        self,
        market_context: dict[str, Any],
        ranked_alerts: list[dict[str, Any]],
        hot_symbols: list[dict[str, Any]],
    ) -> str:
        hot_line = ", ".join(
            str(item.get("symbol", "n/a")) for item in hot_symbols if isinstance(item, dict)
        ) or "none"
        alert_lines = []
        for alert in ranked_alerts:
            if not isinstance(alert, dict):
                continue
            alert_lines.append(
                f"{alert.get('symbol', 'n/a')} {alert.get('side', 'n/a')} "
                f"score={float(alert.get('score', 0)):.1f} "
                f"severity={alert.get('severity', 'n/a')}"
            )
        ranked_line = "; ".join(alert_lines) or "no ranked alerts"
        return (
            "You are an AI market advisor for a perp analytics product. "
            "Summarize the market in 3 to 5 sentences for a trader. "
            "Focus on momentum, narrative confirmation, and entry patience. "
            f"Market summary: {market_context.get('summary_line', 'n/a')}. "
            f"Hot symbols: {hot_line}. "
            f"Top ranked alerts: {ranked_line}. "
            "Do not give guaranteed returns. Keep it concise and actionable."
        )

    def _build_question_prompt(
        self,
        question: str,
        market_context: dict[str, Any],
        ranked_alerts: list[dict[str, Any]],
        hot_symbols: list[dict[str, Any]],
    ) -> str:
        hot_line = ", ".join(
            str(item.get("symbol", "n/a")) for item in hot_symbols if isinstance(item, dict)
        ) or "none"
        ranked_line = "; ".join(
            f"{item.get('symbol', 'n/a')} score={float(item.get('score', 0)):.1f} {item.get('side', 'n/a')}"
            for item in ranked_alerts
            if isinstance(item, dict)
        ) or "no ranked alerts"
        return (
            "You are the DeepSignal ELFA advisor. "
            "Answer the user question in 4 short sentences max. "
            "Base the answer on Pacifica whale flow and ELFA social context. "
            "Avoid guaranteed returns or direct financial promises. "
            f"Market summary: {market_context.get('summary_line', 'n/a')}. "
            f"Hot symbols: {hot_line}. "
            f"Top alerts: {ranked_line}. "
            f"User question: {question}"
        )

    def _build_local_agent_brief(
        self,
        market_context: dict[str, Any],
        ranked_alerts: list[dict[str, Any]],
        hot_symbols: list[dict[str, Any]],
    ) -> dict[str, Any]:
        hot_list = [str(item.get("symbol", "n/a")) for item in hot_symbols if isinstance(item, dict)]
        lead_alert = ranked_alerts[0] if ranked_alerts and isinstance(ranked_alerts[0], dict) else {}
        lead_symbol = str(lead_alert.get("symbol", hot_list[0] if hot_list else "market"))
        lead_side = str(lead_alert.get("side", "watch"))
        summary = (
            f"ELFA agent sees {lead_symbol} as the lead context symbol right now, with "
            f"{lead_side} flow setting the tone. "
            f"Use the Pacifica ranking together with social confirmation before sizing in."
        )
        action_items = [
            f"Start from {lead_symbol} because it currently anchors the strongest signal stack.",
            "Prioritize symbols where whale flow and ELFA attention both align before entering.",
            "Use smaller sizing first if the move already feels crowded or over-extended.",
        ]
        caution = (
            "This layer is an advisor for trend selection and timing context, not an automatic allocation engine."
        )
        return {
            "status": "local",
            "mode": "summary",
            "summary": summary,
            "action_items": action_items,
            "caution": caution,
            "prompt_basis": {
                "hot_symbols": hot_list,
                "ranked_symbols": [str(item.get("symbol", "n/a")) for item in ranked_alerts if isinstance(item, dict)],
            },
        }

    def _build_local_question_response(
        self,
        question: str,
        market_context: dict[str, Any],
        ranked_alerts: list[dict[str, Any]],
        hot_symbols: list[dict[str, Any]],
    ) -> dict[str, Any]:
        lead_symbol = "market"
        if ranked_alerts and isinstance(ranked_alerts[0], dict):
            lead_symbol = str(ranked_alerts[0].get("symbol", lead_symbol))
        elif hot_symbols and isinstance(hot_symbols[0], dict):
            lead_symbol = str(hot_symbols[0].get("symbol", lead_symbol))
        answer = (
            f"For '{question}', start by watching {lead_symbol} because it currently leads the signal stack. "
            "Use whale-flow confirmation and narrative alignment before increasing size. "
            "If the move already feels crowded, treat it as a watch-first setup rather than a chase."
        )
        return {
            "status": "local",
            "mode": "chat",
            "question": question,
            "answer": answer,
            "discord_ready_message": self._build_discord_chat_message(question, answer),
            "market_summary": market_context.get("summary_line", ""),
        }

    def _build_discord_chat_message(self, question: str, answer: str) -> str:
        compact_answer = " ".join(answer.split())
        return f"DeepSignal ELFA Advisor | Q: {question} | A: {compact_answer}"

    def _recommend_action(self, profile: str, side: str, score: float, attention_score: float) -> str:
        floor = float(RISK_PROFILES[profile]["score_floor"])
        if score >= max(floor + 10, 85) and side in {"open_long", "close_short"}:
            return "bias long"
        if score >= max(floor + 10, 85) and side in {"open_short", "close_long"}:
            return "bias short"
        if attention_score >= 70 or score >= floor:
            return "watch for entry"
        return "observe only"

    def _build_confidence(self, score: float, attention_score: float) -> str:
        composite = (score * 0.7) + (attention_score * 0.3)
        if composite >= 85:
            return "high"
        if composite >= 70:
            return "medium"
        return "low"

    def _build_entry_style(self, profile: str, score: float, attention_score: float) -> str:
        if profile == "prudent":
            return "wait for a second confirmation candle" if score < 92 else "scale after confirmation"
        if profile == "aggressive":
            return "probe quickly into strength" if attention_score >= 70 else "small early entry only"
        return "split entry between breakout and retest"

    def _build_thesis(
        self,
        symbol: str,
        side: str,
        enrichment: dict[str, Any],
        narrative_context: dict[str, Any] | None,
    ) -> str:
        explainers = enrichment.get("elfa_explainer", [])
        if isinstance(explainers, list) and explainers:
            return str(explainers[0])

        if narrative_context:
            market_signal = narrative_context.get("market_signal", "n/a")
            avg_score = float(narrative_context.get("avg_score", 0))
            return f"{symbol} shows {market_signal} narrative support with avg signal score {avg_score:.1f}"

        return f"{symbol} is printing {side} flow without enough narrative detail yet."

    def _build_risk(
        self,
        profile: str,
        side: str,
        severity: str,
        narrative_context: dict[str, Any] | None,
    ) -> str:
        market_signal = str(narrative_context.get("market_signal", "n/a")) if narrative_context else "n/a"
        if profile == "prudent":
            return "stay patient and avoid chasing if structure is not confirmed"
        if severity == "critical" and market_signal == "high-attention":
            return "crowded move, chase risk is elevated"
        if side in {"open_short", "close_long"}:
            return "counter-trend squeezes can invalidate the short bias quickly"
        return "wait for confirmation and size entries carefully"


def _extract_token_labels(payload: dict[str, Any]) -> list[str]:
    data = payload.get("data", [])
    if not isinstance(data, list):
        return []

    labels: list[str] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        for field in ("ticker", "symbol", "name", "token"):
            value = item.get(field)
            if isinstance(value, str) and value.strip():
                labels.append(value.strip().upper())
                break
    return labels


def _extract_chat_text(payload: dict[str, Any]) -> str:
    candidates: list[Any] = [payload]
    data = payload.get("data")
    if isinstance(data, dict):
        candidates.append(data)
    elif isinstance(data, list):
        candidates.extend(data)

    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
        if not isinstance(candidate, dict):
            continue
        for key in ("message", "response", "answer", "summary", "content", "text"):
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        choices = candidate.get("choices")
        if isinstance(choices, list):
            for choice in choices:
                if isinstance(choice, dict):
                    message = choice.get("message")
                    if isinstance(message, dict):
                        content = message.get("content")
                        if isinstance(content, str) and content.strip():
                            return content.strip()
                    content = choice.get("content")
                    if isinstance(content, str) and content.strip():
                        return content.strip()
    return ""
