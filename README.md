# EconLens

## Folders
- `fetch_articles.py` builds `articles.csv` from RSS feeds (your shopping list).
- `prompt.txt` is the resource-generation prompt and the spec list.
- `data/articles/*.json` holds one file per article: the details plus the JSON the prompt returned.
- `build_site.py` turns that data into the website files in `site/`.
- `site/` is the website. Only this folder is ever published.

## Adding an article
1. Run the prompt on the article and save its JSON output.
2. Create `data/articles/<short-name>.json` like this (see the Tata Steel example):

```json
{
  "id": "short-unique-name",
  "headline": "Headline as published",
  "source": "Sky News",
  "date": "2026-09-19",
  "url": "https://link-to-the-original-article",
  "status": "Pending review",
  "generated": { ...the JSON returned by the prompt... }
}
```

Do not paste the article text into the file. Status is `Approved`, `Pending review` or `Flagged`.

## Building and publishing
```
python3 -m pip install cryptography
python3 build_site.py
```
The script asks for the teacher password. Use the same one each time.

- Students only ever receive articles marked `Approved` (and relevant). Everything else, plus the teacher-only notes and numeric confidence scores, is encrypted in `site/teacher.enc` and opens only with the teacher password.
- To try the site locally: `cd site && python3 -m http.server 8000`, then open http://localhost:8000.
- To publish: put the contents of `site/` in a GitHub repository and turn on GitHub Pages. Publish only `site/`, not `data/`, because `data/` holds unapproved articles unencrypted.

## Teacher changes made on the website
Approve, Flag and Edit mapping are saved in the teacher's own browser. To make them live, download the review file from the teacher bar, save it as `data/review.json`, and run `build_site.py` again.
