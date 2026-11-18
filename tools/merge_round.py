"""Merge new book files (tools/new_*.json) into tools/books_source.json, with checks."""
import json, sys, glob
p = 'tools/books_source.json'
books = json.load(open(p, encoding='utf-8'))
files = sorted(glob.glob('tools/new_*.json'))
new = [b for f in files for b in json.load(open(f, encoding='utf-8')) if not b.get("unverified")]
have_ids = {b["id"] for b in books}
have_pairs = {(b["title"], b["author"]) for b in books}
have_en = {(b["en"].lower(), b["enAuthor"].lower()) for b in books}
added, skipped = [], []
need = {"id","title","author","en","enAuthor","year","cats","tags","style","pop","adult","summary"}
for b in new:
    missing = need - set(b)
    if missing: sys.exit(f"{b.get('id')}: missing {missing}")
    if b["id"] in have_ids or (b["title"], b["author"]) in have_pairs or (b["en"].lower(), b["enAuthor"].lower()) in have_en:
        skipped.append(b["title"]); continue
    have_ids.add(b["id"]); have_pairs.add((b["title"], b["author"])); have_en.add((b["en"].lower(), b["enAuthor"].lower()))
    added.append(b)
books += added
with open(p, 'w', encoding='utf-8') as f:
    f.write("[\n" + ",\n".join("  " + json.dumps(b, ensure_ascii=False) for b in books) + "\n]\n")
from collections import Counter
print(f"added {len(added)}, skipped duplicates {skipped}, total {len(books)}")
print(dict(Counter(c for b in books for c in b["cats"])))
for f in files: __import__('os').remove(f)
