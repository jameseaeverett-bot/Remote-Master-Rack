#!/usr/bin/env python3
"""Local, token-safe publishing service for the RMR Owner Portal."""
import base64
import json
import os
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPOSITORY = "jameseaeverett-bot/Remote-Master-Rack"
BRANCH = "main"
CONTENT_FILE = "website-content.json"
ALLOWED_ORIGIN = "https://jameseaeverett-bot.github.io"
FIELDS = {"heroHeading": 140, "heroBody": 300, "primaryButton": 40, "secondaryButton": 40, "statusText": 50, "footerText": 100}

def github_request(url, method="GET", body=None):
    token = os.environ.get("RMR_GITHUB_TOKEN")
    if not token:
        raise RuntimeError("Publishing is not configured on this Mac.")
    request = urllib.request.Request(url, data=body, method=method, headers={
        "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "RMR-Owner-Portal"
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def send_json(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(HTTPStatus.OK, {"service": "rmr-owner-portal", "publishReady": bool(os.environ.get("RMR_GITHUB_TOKEN"))})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/publish":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                raise ValueError("Invalid request size.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            content = payload.get("content", {})
            if set(content) != set(FIELDS):
                raise ValueError("Website content fields are invalid.")
            for field, limit in FIELDS.items():
                if not isinstance(content[field], str) or not content[field].strip() or len(content[field].strip()) > limit:
                    raise ValueError(f"{field} is invalid.")
            source = github_request(f"https://api.github.com/repos/{REPOSITORY}/contents/{CONTENT_FILE}?ref={BRANCH}")
            formatted = json.dumps({field: content[field].strip() for field in FIELDS}, indent=2) + "\n"
            update = {"message": "Publish website content from Owner Portal", "content": base64.b64encode(formatted.encode("utf-8")).decode("ascii"), "sha": source["sha"], "branch": BRANCH}
            result = github_request(f"https://api.github.com/repos/{REPOSITORY}/contents/{CONTENT_FILE}", "PUT", json.dumps(update).encode("utf-8"))
            self.send_json(HTTPStatus.OK, {"ok": True, "commit": result["commit"]["sha"], "commitUrl": result["commit"]["html_url"]})
        except RuntimeError as error:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "error": str(error)})
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})
        except urllib.error.HTTPError as error:
            self.send_json(error.code, {"ok": False, "error": "GitHub rejected the publish request. Check the Owner Portal token permissions."})
        except Exception:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": "The publishing service could not reach GitHub."})

if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("RMR_OWNER_PORTAL_PORT", "4173"))), Handler).serve_forever()
