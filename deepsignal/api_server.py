from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from deepsignal.app import DeepSignalApp


def serve_api(app: DeepSignalApp, host: str = "127.0.0.1", port: int = 8765) -> None:
    server = ThreadingHTTPServer((host, port), _build_handler(app))
    print(f"DeepSignal API listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def _build_handler(app: DeepSignalApp) -> type[BaseHTTPRequestHandler]:
    class DeepSignalApiHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            if self.path not in {"/api/advisor-chat", "/api/advisor-discord"}:
                self._write_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
                return

            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                content_length = 0

            raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                payload = json.loads(raw_body.decode("utf-8"))
            except json.JSONDecodeError:
                self._write_json({"error": "invalid json"}, status=HTTPStatus.BAD_REQUEST)
                return

            if self.path == "/api/advisor-chat":
                question = str(payload.get("question", "")).strip()
                lookback_hours = int(payload.get("lookback_hours", 24) or 24)
                if not question:
                    self._write_json({"error": "question is required"}, status=HTTPStatus.BAD_REQUEST)
                    return

                try:
                    response = app.ask_advisor_question(question, lookback_hours=lookback_hours)
                except Exception as exc:  # pragma: no cover - defensive runtime surface
                    self._write_json(
                        {"error": "advisor chat failed", "details": str(exc)},
                        status=HTTPStatus.INTERNAL_SERVER_ERROR,
                    )
                    return

                self._write_json(response)
                return

            message = str(payload.get("message", "")).strip()
            if not message:
                self._write_json({"error": "message is required"}, status=HTTPStatus.BAD_REQUEST)
                return
            try:
                response = app.send_advisor_message_to_discord(message)
            except Exception as exc:  # pragma: no cover - defensive runtime surface
                self._write_json(
                    {"error": "discord delivery failed", "details": str(exc)},
                    status=HTTPStatus.INTERNAL_SERVER_ERROR,
                )
                return
            self._write_json(response)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.end_headers()

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            return

        def _write_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)

    return DeepSignalApiHandler
