#!/usr/bin/env python3
"""
Cross-platform launcher for the interactive YAML diagram viewer.

Usage:
  python start-diagram.py
  python start-diagram.py --port 8080
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import socketserver
import sys
import webbrowser
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start local server for diagram viewer.")
    parser.add_argument("--port", "-p", type=int, default=8080, help="HTTP port (default: 8080)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    port = args.port

    if not (1 <= port <= 65535):
        print("Error: port must be between 1 and 65535.", file=sys.stderr)
        return 2

    project_root = Path(__file__).resolve().parent
    os.chdir(project_root)
    target_yaml_path = (project_root / "YAML" / "features.yaml").resolve()

    url = f"http://localhost:{port}/viewer/"
    print(f"Serving from: {project_root}")
    print(f"Opening: {url}")
    print("Press Ctrl+C to stop.")

    class DiagramRequestHandler(http.server.SimpleHTTPRequestHandler):
        def do_POST(self) -> None:
            if self.path != "/api/save-yaml":
                self.send_error(404, "Endpoint introuvable")
                return

            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0:
                self.send_error(400, "Body JSON requis")
                return

            raw = self.rfile.read(content_length)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except Exception:
                self.send_error(400, "JSON invalide")
                return

            requested_path = str(payload.get("path", "")).replace("\\", "/")
            yaml_text = payload.get("yaml")

            if requested_path not in {"YAML/features.yaml", "../YAML/features.yaml"}:
                self.send_error(400, "Seul YAML/features.yaml est autorise")
                return

            if not isinstance(yaml_text, str):
                self.send_error(400, "Champ 'yaml' manquant")
                return

            try:
                target_yaml_path.write_text(yaml_text, encoding="utf-8")
            except OSError as exc:
                self.send_error(500, f"Echec ecriture: {exc}")
                return

            data = json.dumps({"ok": True, "saved": str(target_yaml_path)}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: object) -> None:
            super().log_message(format, *args)

    handler = DiagramRequestHandler
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
            webbrowser.open(url)
            httpd.serve_forever()
    except OSError as exc:
        print(f"Error: unable to start server on port {port}: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nServer stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
