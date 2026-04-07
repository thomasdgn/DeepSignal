from __future__ import annotations

from typing import Any

import requests


class ElfaApiClient:
    def __init__(self, api_key: str, base_url: str = "https://api.elfa.ai", timeout: int = 15) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def get_key_status(self) -> dict[str, Any]:
        return self._get("/v2/key-status")

    def get_top_mentions(
        self,
        ticker: str,
        *,
        time_window: str = "1h",
        page: int = 1,
        page_size: int = 3,
    ) -> dict[str, Any]:
        return self._get(
            "/v2/data/top-mentions",
            params={
                "ticker": ticker.lower(),
                "timeWindow": time_window,
                "page": page,
                "pageSize": page_size,
            },
        )

    def get_token_news(
        self,
        ticker: str,
        *,
        time_window: str = "24h",
        page: int = 1,
        page_size: int = 3,
    ) -> dict[str, Any]:
        return self._get(
            "/v2/data/token-news",
            params={
                "ticker": ticker.lower(),
                "timeWindow": time_window,
                "page": page,
                "pageSize": page_size,
            },
        )

    def get_trending_narratives(
        self,
        *,
        time_window: str = "24h",
        page: int = 1,
        page_size: int = 5,
    ) -> dict[str, Any]:
        return self._get(
            "/v2/data/trending-narratives",
            params={
                "timeWindow": time_window,
                "page": page,
                "pageSize": page_size,
            },
        )

    def get_trending_tokens(
        self,
        *,
        time_window: str = "24h",
        page: int = 1,
        page_size: int = 10,
        min_mentions: int = 3,
        ) -> dict[str, Any]:
        return self._get(
            "/v2/aggregations/trending-tokens",
            params={
                "timeWindow": time_window,
                "page": page,
                "pageSize": page_size,
                "minMentions": min_mentions,
            },
        )

    def chat(
        self,
        *,
        message: str,
        mode: str = "summary",
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "message": message,
            "mode": mode,
        }
        if conversation_id:
            payload["conversationId"] = conversation_id
        return self._post("/v2/chat", json_body=payload)

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = requests.get(
                f"{self.base_url}{path}",
                headers={
                    "Accept": "application/json",
                    "x-elfa-api-key": self.api_key,
                },
                params=params,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            raise RuntimeError(f"ELFA request failed for {path}: {exc}") from exc

    def _post(self, path: str, json_body: dict[str, Any]) -> dict[str, Any]:
        try:
            response = requests.post(
                f"{self.base_url}{path}",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "x-elfa-api-key": self.api_key,
                },
                json=json_body,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            raise RuntimeError(f"ELFA request failed for {path}: {exc}") from exc
