"""Serve the combined directory and its local comment API."""

import argparse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import sqlite3


ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/details.css": ("details.css", "text/css; charset=utf-8"),
}
COMMENTS_PATH = re.compile(r"/api/cheats/([a-z0-9-]+)/comments")
PAGE = (ROOT / "index.html").read_text(encoding="utf-8")
CHEAT_IDS = {
    item["id"]
    for item in json.loads(re.search(r'<script id="cheat-data" type="application/json">(.*?)</script>', PAGE)[1])
}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, content_type, payload):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def json(self, status, data):
        self.reply(status, "application/json; charset=utf-8", json.dumps(data).encode("utf-8"))

    def check_host(self):
        port = self.server.server_port
        host = self.headers.get("Host")
        if host in {f"localhost:{port}", f"127.0.0.1:{port}"}:
            return True
        self.json(403, {"error": "Use localhost to open the directory."})
        return False

    def cheat_id(self):
        match = COMMENTS_PATH.fullmatch(self.path.split("?", 1)[0])
        if match and match[1] in CHEAT_IDS:
            return match[1]
        self.json(404, {"error": "Cheat or page not found."})
        return None

    def read_comments(self, cheat_id, new_comment=None):
        try:
            with sqlite3.connect(self.server.database) as db:
                if new_comment is not None:
                    db.execute(
                        "INSERT INTO comments (cheat_id, author, body, created_at) VALUES (?, ?, ?, ?)",
                        (cheat_id, *new_comment, datetime.now(timezone.utc).isoformat()),
                    )
                db.row_factory = sqlite3.Row
                rows = db.execute(
                    'SELECT author, body, created_at AS "createdAt" FROM comments WHERE cheat_id = ? ORDER BY id',
                    (cheat_id,),
                ).fetchall()
            self.json(201 if new_comment else 200, [dict(row) for row in rows])
        except sqlite3.Error:
            self.json(500, {"error": "Could not access the local comment database."})

    def do_GET(self):
        if not self.check_host():
            return
        asset = ASSETS.get(self.path.split("?", 1)[0])
        if asset:
            name, content_type = asset
            self.reply(200, content_type, (ROOT / name).read_bytes())
            return
        cheat_id = self.cheat_id()
        if cheat_id:
            self.read_comments(cheat_id)

    do_HEAD = do_GET

    def do_POST(self):
        if not self.check_host():
            return
        cheat_id = self.cheat_id()
        if not cheat_id:
            return
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers["Host"]:
            self.json(403, {"error": "Comments can only be posted from the local directory."})
            return
        if self.headers.get_content_type() != "application/json":
            self.json(415, {"error": "Send comment data as JSON."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16384:
                raise ValueError
            data = json.loads(self.rfile.read(length))
            author = data["author"].strip()
            body = data["body"].strip()
            if len(author) > 40 or not 0 < len(body) <= 1000:
                raise ValueError
        except (ValueError, KeyError, TypeError, AttributeError):
            self.json(400, {"error": "Enter a comment up to 1,000 characters and an optional name up to 40 characters."})
            return
        self.read_comments(cheat_id, (author or "Anonymous", body))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--db", type=Path, default=ROOT / "comments.sqlite3")
    args = parser.parse_args()
    args.db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(args.db) as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY, cheat_id TEXT NOT NULL,
                author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
            )"""
        )
        db.execute("CREATE INDEX IF NOT EXISTS comments_by_cheat ON comments (cheat_id, id)")
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        server.database = args.db.resolve()
        print(f"GTA VI Cheat Directory is running at http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
