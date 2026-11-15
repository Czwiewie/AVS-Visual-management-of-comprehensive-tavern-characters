#!/usr/bin/env python3
"""Fetch Pixiv public monthly illustration ranking; write only verified top-50.

No private APIs, cookies, captcha circumvention, image mirroring, or fabricated data.
Network/robots/ToS controls can prevent successful fetch. In that case preserve
the last verified snapshot and let the GitHub Action fail visibly.
"""
import datetime as dt
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "pixiv-monthly.json"
BASE = "https://www.pixiv.net/ranking.php"
QUERY = {"mode": "monthly", "content": "illust", "p": 1}
URL = BASE + "?" + urllib.parse.urlencode(QUERY)
FALLBACK_JSON_URL = URL + "&format=json"


def download(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; AVS-monthly-metadata-sync/1.0)",
            "Accept": "application/json,text/html;q=0.9,*/*;q=0.5",
            "Referer": "https://www.pixiv.net/",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as res:
        content = res.read(1500001)
        if len(content) > 1500000:
            raise ValueError("Ranked page too large")
        return content.decode("utf-8", errors="replace")


def json_entries(body):
    payload = json.loads(body)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("contents", "rankings", "items", "data", "response"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                for nested in ("contents", "rankings", "items"):
                    if isinstance(val.get(nested), list):
                        return val[nested]
    raise ValueError("Ranking returned JSON without a recognized artwork list")


class RankingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
    def handle_starttag(self, tag, attrs):
        if tag not in ("section", "article"):
            return
        props = dict(attrs)
        pid = props.get("data-id") or props.get("data-illust-id")
        rank = props.get("data-rank") or props.get("id", "").replace("rank-", "")
        css = " " + props.get("class", "") + " "
        if not rank and (" ranking-item " in css or " ranking-item-container " in css):
            rank = str(len(self.items) + 1)  # page item sequence = rank in ranking-items
        if pid and pid.isdigit() and rank.isdigit():
            self.items.append({
                "illust_id": pid, "rank": rank,
                "title": props.get("data-title", ""), "user_name": props.get("data-user-name", ""),
            })


def html_entries(body):
    parser = RankingParser()
    parser.feed(body)
    if len(parser.items) < 50:
        raise ValueError("Public ranking HTML missing 50 readable items; do not invent rankings")
    return parser.items


def text(v, maxlen=160):
    return html.unescape(str(v or "")).replace("\x00", "").strip()[:maxlen]


def normalize(raw):
    if not isinstance(raw, list):
        raise ValueError("Expected artwork list")
    result, seen = [], set()
    for position, x in enumerate(raw):
        if not isinstance(x, dict):
            continue
        ident = str(x.get("illust_id") or x.get("id") or x.get("illustId") or "")
        if not ident.isdecimal():
            continue
        rank = x.get("rank", position + 1)
        try:
            rank = int(rank)
        except (TypeError, ValueError):
            continue
        if not (1 <= rank <= 50) or ident in seen:
            continue
        seen.add(ident)
        tags = x.get("tags") or []
        if isinstance(tags, list):
            tags = [text(a.get("tag") if isinstance(a, dict) else a, 55) for a in tags][:20]
        else:
            tags = []
        thumb = str(x.get("url") or x.get("thumbnail") or x.get("image") or "")
        if not thumb.startswith("https://i.pximg.net/"):
            thumb = ""
        result.append({
            "rank": rank,
            "id": ident,
            "title": text(x.get("title"), 180) or "未命名",
            "artist": text(x.get("user_name") or x.get("author") or x.get("artist"), 90) or "未知画师",
            "tags": tags,
            "thumbnail": thumb,
            "url": f"https://www.pixiv.net/artworks/{ident}",
        })
    result.sort(key=lambda a: a["rank"])
    if len(result) != 50 or [r["rank"] for r in result] != list(range(1, 51)):
        raise ValueError(f"Ranking incomplete or invalid: {len(result)} items; latest verified snapshot remains unchanged")
    return result


def main():
    if os.environ.get("AVS_PIXIV_FIXTURE"):
        # Offline parser test only. Never publish fabricated fixtures.
        raw = Path(os.environ["AVS_PIXIV_FIXTURE"]).read_text("utf-8")
        source = "offline-test-fixture"
        try:
            entries = json_entries(raw)
        except json.JSONDecodeError:
            entries = html_entries(raw)
        items = normalize(entries)
    else:
        # Start with the actual public ranking webpage, not a paid third-party API.
        try:
            entries = html_entries(download(URL))
            items = normalize(entries)
            source = URL
        except Exception as page_error:
            # The site's legacy JSON-format representation is a compatibility fallback.
            # Both are subject to Pixiv access restrictions; never bypass them.
            try:
                entries = json_entries(download(FALLBACK_JSON_URL))
                items = normalize(entries)
                source = FALLBACK_JSON_URL
            except Exception as json_error:
                raise RuntimeError(
                    f"Public HTML failed: {page_error}; legacy JSON failed: {json_error}"
                ) from json_error
    if os.environ.get("AVS_PIXIV_FIXTURE"):
        print(json.dumps({"verifiedCount": len(items)}, ensure_ascii=False))
        return
    output = {
        "status": "ok",
        "source": source,
        "syncedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "items": items,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    temp = DEST.with_name(DEST.name + ".tmp")
    temp.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", "utf-8")
    temp.replace(DEST)
    print(f"Saved {len(items)} verified monthly artworks (metadata only).")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PIXIV_SYNC_UNAVAILABLE:", type(exc).__name__, str(exc), file=sys.stderr)
        sys.exit(1)
