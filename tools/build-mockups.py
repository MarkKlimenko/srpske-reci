#!/usr/bin/env python3
"""Builds mockups.html from the canvas artboards (*.dc.html + canvas.json).

    python3 tools/build-mockups.py <dir-with-canvas.json>
"""
import json
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "mockups.html"
canvas = json.loads((src / "canvas.json").read_text(encoding="utf-8"))

frames = []
for name in canvas["order"]:
    html = (src / name).read_text(encoding="utf-8")
    body = re.search(r"<x-dc>(.*)</x-dc>", html, re.S).group(1)
    body = re.sub(r"<helmet>.*?</helmet>", "", body, flags=re.S).strip()
    title = canvas["boards"][name].get("title", name)
    frames.append(f'<figure><figcaption>{title}</figcaption><div class="phone">{body}</div></figure>')

page = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Srpske reči — макеты</title>
<style>
body{{margin:0;background:#ece6d6;font-family:-apple-system,system-ui,sans-serif;color:#2a2317}}
h1{{font-family:Georgia,serif;font-weight:normal;margin:32px 32px 0}}
main{{display:flex;flex-wrap:wrap;gap:48px;padding:32px}}
figure{{margin:0;display:flex;flex-direction:column;gap:12px}}
figcaption{{font-size:14px;color:#6f6450}}
.phone{{width:390px;height:844px;border-radius:28px;overflow:hidden;box-shadow:0 8px 32px rgba(90,70,30,.18);position:relative}}
.phone button{{font-family:inherit;cursor:default}}
</style>
</head>
<body>
<h1>{canvas["title"]}</h1>
<main>
{chr(10).join(frames)}
</main>
</body>
</html>
"""
out.write_text(page, encoding="utf-8")
print(f"{len(frames)} screens → {out}")
