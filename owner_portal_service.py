#!/usr/bin/env python3
"""Local, token-safe publishing service for the RMR Owner Portal."""
import base64
import getpass
import json
import os
import subprocess
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

def keychain_token():
    result = subprocess.run(["/usr/bin/security", "find-generic-password", "-a", getpass.getuser(), "-s", "RMR_GITHUB_TOKEN", "-w"], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ""

def github_request(url, method="GET", body=None):
    token = keychain_token()
    if not token:
        raise RuntimeError("GitHub token missing. Select Configure GitHub Publishing to set it up.")
    request = urllib.request.Request(url, data=body, method=method, headers={
        "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "RMR-Owner-Portal"
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))

def publishing_status():
    token = keychain_token()
    if not token:
        return {"configured": False, "code": "missing_token", "message": "GitHub token missing. Create a fine-grained token with Contents: Read and write for Remote-Master-Rack, then select Configure GitHub Publishing."}
    try:
        repository = github_request(f"https://api.github.com/repos/{REPOSITORY}")
        if repository.get("default_branch") != BRANCH:
            return {"configured": False, "code": "branch_missing", "message": "The repository does not have the expected main branch."}
        return {"configured": True, "code": "ready", "message": "GitHub publishing connected.", "repository": repository["full_name"]}
    except urllib.error.HTTPError as error:
        if error.code == 401:
            message = "The GitHub token is invalid or has expired. Configure GitHub Publishing again."
        elif error.code in (403, 404):
            message = "The GitHub token cannot access jameseaeverett-bot/Remote-Master-Rack. Grant Contents: Read and write access to that repository."
        else:
            message = f"GitHub connection failed (HTTP {error.code})."
        return {"configured": False, "code": f"github_{error.code}", "message": message}
    except Exception:
        return {"configured": False, "code": "network_error", "message": "Unable to reach GitHub. Check this Mac’s internet connection and try again."}

def configure_keychain_token():
    script = ('try\n'
              'display dialog "Paste a fine-grained GitHub token for RMR Website publishing. It needs Contents: Read and write access to jameseaeverett-bot/Remote-Master-Rack." '
              'default answer "" with hidden answer buttons {"Cancel", "Save Token"} default button "Save Token"\n'
              'text returned of result\n'
              'on error number -128\nreturn ""\nend try')
    result = subprocess.run(["/usr/bin/osascript", "-e", script], capture_output=True, text=True)
    token = result.stdout.strip()
    if not token:
        return {"configured": False, "code": "setup_cancelled", "message": "GitHub publishing setup was cancelled. No token was stored."}
    stored = subprocess.run(["/usr/bin/security", "add-generic-password", "-U", "-a", getpass.getuser(), "-s", "RMR_GITHUB_TOKEN", "-w", token], capture_output=True, text=True)
    if stored.returncode != 0:
        return {"configured": False, "code": "keychain_write_failed", "message": "macOS Keychain could not store the GitHub token."}
    return publishing_status()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.headers.get("Origin") == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def send_json(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(encoded))); self.end_headers(); self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT); self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers", "Content-Type"); self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(HTTPStatus.OK, {"service": "rmr-owner-portal", "version": 2, "publishReady": publishing_status()["configured"]}); return
        if self.path == "/api/publishing-status":
            status = publishing_status(); self.send_json(HTTPStatus.OK if status["configured"] else HTTPStatus.SERVICE_UNAVAILABLE, status); return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/configure-github":
            status = configure_keychain_token(); self.send_json(HTTPStatus.OK if status["configured"] else HTTPStatus.BAD_REQUEST, status); return
        if self.path != "/api/publish": self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"}); return
        setup = publishing_status()
        if not setup["configured"]: self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "error": setup["message"], "setup": setup}); return
        try:
            length = int(self.headers.get("Content-Length", "0")); payload = json.loads(self.rfile.read(length).decode("utf-8")); content = payload.get("content", {})
            if length <= 0 or length > 4096 or set(content) != set(FIELDS): raise ValueError("Website content fields are invalid.")
            for field, limit in FIELDS.items():
                if not isinstance(content[field], str) or not content[field].strip() or len(content[field].strip()) > limit: raise ValueError(f"{field} is invalid.")
            source = github_request(f"https://api.github.com/repos/{REPOSITORY}/contents/{CONTENT_FILE}?ref={BRANCH}")
            formatted = json.dumps({field: content[field].strip() for field in FIELDS}, indent=2) + "\n"
            update = {"message": "Publish website content from Owner Portal", "content": base64.b64encode(formatted.encode()).decode(), "sha": source["sha"], "branch": BRANCH}
            result = github_request(f"https://api.github.com/repos/{REPOSITORY}/contents/{CONTENT_FILE}", "PUT", json.dumps(update).encode())
            self.send_json(HTTPStatus.OK, {"ok": True, "commit": result["commit"]["sha"], "commitUrl": result["commit"]["html_url"]})
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})
        except urllib.error.HTTPError as error:
            self.send_json(error.code, {"ok": False, "error": f"GitHub rejected the publish request (HTTP {error.code})."})
        except Exception:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": "The publishing service could not reach GitHub."})

if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("RMR_OWNER_PORTAL_PORT", "4173"))), Handler).serve_forever()
