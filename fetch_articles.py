"""
EconLens - step 1 helper: pull recent articles from RSS feeds into a CSV.

Setup (once):   pip install feedparser certifi
Run:            python fetch_articles.py
Output:         articles.csv  (open in Excel/Sheets, pick your 20 test articles)

RSS only gives headline, link, date and a short description, so this is a
"shopping list". Open the link and paste the article text into your prompt.
"""
import csv
import ssl
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import certifi
import feedparser

# Add more sources by pasting the RSS link from each site's RSS page.
FEEDS = {
    "BBC Business": "http://feeds.bbci.co.uk/news/business/rss.xml",
    "CNBC World": "https://www.cnbc.com/id/100727362/device/rss/rss.html",
    "CNBC Economy": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "Bank of England": "https://www.bankofengland.co.uk/rss/news",
    "BoE Speeches": "https://www.bankofengland.co.uk/rss/speeches",
    "BoE Publications": "https://www.bankofengland.co.uk/rss/publications",
    # "ONS": "<paste RSS URL here>",
}

DAYS_BACK = 30
OUTPUT_FILE = "articles.csv"

# Only used to flag likely economic articles in the CSV. Nothing is filtered out.
KEYWORDS = [
    "inflation", "interest rate", "gdp", "unemployment", "wage", "tariff",
    "trade", "exchange rate", "pound", "budget", "tax", "growth", "recession",
    "productivity", "monopoly", "competition", "merger", "subsidy", "energy price",
]


def fetch_feed(url):
    # Use certifi's CA bundle: python.org builds on macOS often lack system certs.
    ctx = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
        return feedparser.parse(resp.read())


def published_dt(entry):
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    return datetime.fromtimestamp(time.mktime(parsed), tz=timezone.utc)


def main():
    cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    seen_urls = set()
    rows = []

    for source, url in FEEDS.items():
        try:
            feed = fetch_feed(url)
        except OSError as err:
            print(f"Could not read {source}: {err}")
            continue
        if feed.bozo and not feed.entries:
            print(f"Could not read {source}: {url}")
            continue
        print(f"{source}: {len(feed.entries)} items found")

        for entry in feed.entries:
            link = entry.get("link", "").strip()
            if not link or link in seen_urls:
                continue
            when = published_dt(entry)
            if when and when < cutoff:
                continue
            seen_urls.add(link)

            title = entry.get("title", "").strip()
            summary = entry.get("summary", "").strip()
            text = f"{title} {summary}".lower()
            rows.append({
                "source": source,
                "published": when.strftime("%Y-%m-%d") if when else "",
                "title": title,
                "url": link,
                "rss_summary": summary,
                "keyword_hit": any(k in text for k in KEYWORDS),
            })

    rows.sort(key=lambda r: r["published"], reverse=True)

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["source", "published", "title", "url", "rss_summary", "keyword_hit"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved {len(rows)} articles to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
