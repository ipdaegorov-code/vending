"""Собирает прототип с демо-данными (для показа в Claude) из web/index.html + web/demo.js."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / "web/index.html").read_text(encoding="utf-8")
demo = (root / "web/demo.js").read_text(encoding="utf-8")
head_end = s.index("</head><body>")
head = s[:head_end]
title = re.search(r"<title>.*?</title>", head).group(0).replace("Вендинг", "Вендинг · прототип")
keep = "\n".join(re.findall(r'<meta name="claude:viewport-fit-sides"[^>]*>|<link rel="preconnect"[^>]*>|<link rel="stylesheet"[^>]*>', head))
style = head[head.index("<style>\n"):]  # основной блок стилей
body = s[head_end + len("</head><body>"):].replace("</body></html>", "")
body = body.replace("<script>", "<script>\n" + demo + "\n</script>\n<script>", 1)
out = f"{title}\n{keep}\n{style}\n{body}"
pathlib.Path(sys.argv[1]).write_text(out, encoding="utf-8")
print("ok", len(out))
