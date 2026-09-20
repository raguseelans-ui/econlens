"""
EconLens - build the website data.

Reads   data/articles/*.json   (one file per article, see README.md)
        data/review.json       (optional teacher changes exported from the site)
        prompt.txt             (the spec list)
Writes  site/public.json       approved, relevant articles only, teacher-only fields removed
        site/teacher.enc       every article, encrypted with the teacher password
        site/specs.json        spec codes for the Edit mapping dropdown

Setup (once):   pip install cryptography
Run:            python3 build_site.py
The teacher password is asked for each time (or set ECONLENS_PASSWORD).
"""
import base64
import copy
import getpass
import json
import os
import re
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).parent
ITERATIONS = 310_000
STATUSES = {"Approved", "Pending review", "Flagged"}


def load_specs():
    specs, themes, in_list = [], {}, False
    for line in (ROOT / "prompt.txt").read_text(encoding="utf-8").splitlines():
        if line.startswith("SPEC LIST"):
            in_list = True
            continue
        if line.startswith("TASKS"):
            break
        if not in_list:
            continue
        m = re.match(r"THEME (\d): (.+)", line)
        if m:
            themes[m.group(1)] = m.group(2).strip()
            continue
        for part in line.split("|"):
            m = re.match(r"\s*(\d\.\d\.\d+)\s+(.+?)\s*$", part)
            if m:
                specs.append({"code": m.group(1), "title": m.group(2), "theme": int(m.group(1)[0])})
    return specs, themes


def band(confidence):
    if confidence is None:
        return ""
    return "High" if confidence >= 0.8 else "Medium" if confidence >= 0.5 else "Low"


def load_articles(spec_titles):
    review_path = ROOT / "data" / "review.json"
    review = json.loads(review_path.read_text(encoding="utf-8")) if review_path.exists() else {}
    articles = []
    for path in sorted((ROOT / "data" / "articles").glob("*.json")):
        art = json.loads(path.read_text(encoding="utf-8"))
        art.setdefault("status", "Pending review")
        art.setdefault("url", "")
        art.update(review.get(art["id"], {}))
        gen = art.get("generated") or {}
        mapping = gen.setdefault("mapping", {})
        if art["status"] not in STATUSES:
            sys.exit(f"{path.name}: status must be one of {sorted(STATUSES)}")
        code = mapping.get("primary_code", "")
        if gen.get("relevant") and code not in spec_titles:
            print(f"Warning: {path.name} has primary code '{code}' that is not in the spec list")
        for c in mapping.get("secondary_codes", []):
            if c not in spec_titles:
                print(f"Warning: {path.name} has secondary code '{c}' that is not in the spec list")
        mapping["confidence_band"] = band(mapping.get("confidence"))
        art.pop("article_text", None)  # never keep full article text
        articles.append(art)
    articles.sort(key=lambda a: a.get("date", ""), reverse=True)
    return articles


def student_copy(art):
    out = copy.deepcopy(art)
    out["generated"]["mapping"].pop("confidence", None)
    out["generated"].get("discussion", {}).pop("teacher_note", None)
    return out


def encrypt(payload, password):
    salt, nonce = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(hashes.SHA256(), 32, salt, ITERATIONS).derive(password.encode("utf-8"))
    data = AESGCM(key).encrypt(nonce, json.dumps(payload).encode("utf-8"), None)
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    return {"v": 1, "iter": ITERATIONS, "salt": b64(salt), "iv": b64(nonce), "data": b64(data)}


def main():
    specs, themes = load_specs()
    articles = load_articles({s["code"]: s["title"] for s in specs})
    public = [student_copy(a) for a in articles
              if a["status"] == "Approved" and a["generated"].get("relevant")]

    password = os.environ.get("ECONLENS_PASSWORD") or getpass.getpass("Teacher password: ")
    if len(password) < 8:
        sys.exit("Please use a teacher password of at least 8 characters.")

    site = ROOT / "site"
    site.mkdir(exist_ok=True)
    dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    (site / "public.json").write_text(dump(public), encoding="utf-8")
    (site / "teacher.enc").write_text(json.dumps(encrypt(articles, password)), encoding="utf-8")
    (site / "specs.json").write_text(dump({"themes": themes, "specs": specs}), encoding="utf-8")
    print(f"{len(articles)} articles in total, {len(public)} published for students.")


if __name__ == "__main__":
    main()
