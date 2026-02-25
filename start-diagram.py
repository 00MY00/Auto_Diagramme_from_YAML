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

    url = f"http://localhost:{port}/viewer/"
    print(f"Serving from: {project_root}")
    print(f"Opening: {url}")
    print("Press Ctrl+C to stop.")

    handler = http.server.SimpleHTTPRequestHandler
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
